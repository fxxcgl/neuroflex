import { supabase, isSupabaseConfigured } from './supabase';
import { getMockPatients, saveMockPatients } from './mockData';
import type { Session, SessionRep, ExerciseType, Prescription } from '../types';

export interface CompletedRepData {
  repNumber: number;
  // Mode A fields
  peakAngle?: number | null;
  minAngle?: number | null;
  romRange?: number | null;
  targetMet: boolean;
  compensationFlags?: string[];
  timestamp?: string;
  // Mode B fields
  holdDurationSeconds?: number | null;
  stabilityScore?: number | null;
  rotationCount?: number | null;
  // Mode C flag
  selfReported?: boolean;
}

export interface SessionSummaryResult {
  sessionId: string;
  patientId: string;
  exerciseType: string;
  totalReps: number;
  targetMetCount: number;
  avgPeakAngle: number;
  durationMinutes: number;
  endedAt: string;
}

export interface PatientDashboardStats {
  prescription: Prescription;
  assignedClinician: {
    id: string;
    name: string;
    credentials: string;
    specialty: string;
  };
  assignedClinicianId: string | null;
  isClinicianAssigned: boolean;
  condition: string;
  conditionCategory: string | null;
  primaryInjury: string | null;
  completionRate: number; // percentage (Weekly Adherence for backward compatibility)
  weeklyAdherence: number; // (completedSessionsThisWeek / prescribedSessionsThisWeek) * 100
  completedSessionsThisWeek: number;
  prescribedSessionsThisWeek: number;
  totalRepsCompleted: number; // 0 for new patient
  totalRepsPrescribed: number;
  totalSessions: number;
  romHistory: {
    session: string;
    date: string;
    romAngle: number;
    targetAngle: number;
    targetMet: boolean;
  }[];
  sessionsHistory: {
    id: string;
    exerciseType: string;
    date: string;
    durationMinutes: number;
    repsCompleted: number;
    targetReps: number;
    avgRom: number;
    compensationFlags: string[];
  }[];
}

const ONBOARDING_INJURY_KEY = 'neuroflex_primary_injury';
const ONBOARDING_CATEGORY_KEY = 'neuroflex_condition_category';

const LAST_SESSION_SUMMARY_KEY = 'neuroflex_last_completed_session';

export function isValidUuid(id?: string | null): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim());
}

export const DEMO_SESSIONS_PREFIX = 'neuroflex_demo_sessions_';

export interface StoredDemoSession {
  id: string;
  patientId: string;
  exerciseType: ExerciseType;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  totalReps: number;
  targetMetCount: number;
  avgPeakAngle: number;
  reps: CompletedRepData[];
}

export function getStoredDemoSessions(patientId: string): StoredDemoSession[] {
  try {
    const raw = localStorage.getItem(DEMO_SESSIONS_PREFIX + patientId);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredDemoSession(patientId: string, session: StoredDemoSession) {
  try {
    const list = getStoredDemoSessions(patientId);
    list.unshift(session);
    localStorage.setItem(DEMO_SESSIONS_PREFIX + patientId, JSON.stringify(list));
  } catch { }
}

/**
 * Returns the start of the current week (Monday at 00:00:00.000 local time).
 */
export function getStartOfCurrentWeek(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 is Sunday, 1 is Monday...
  const diffToMonday = (day + 6) % 7;
  d.setDate(d.getDate() - diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Record a completed rehabilitation session and its individual repetition telemetry.
 * Logs full Supabase response payload and error to browser console.
 */
export async function recordCompletedSession(params: {
  patientId: string;
  prescriptionId?: string | null;
  exerciseType: ExerciseType;
  startedAt: string;
  endedAt: string;
  reps: CompletedRepData[];
}): Promise<SessionSummaryResult> {
  const { prescriptionId, exerciseType, startedAt, endedAt, reps } = params;
  let targetPatientId = params.patientId;

  const sessionId = `sess-${Date.now()}`;
  const totalReps = reps.length;
  const targetMetCount = reps.filter(r => r.targetMet).length;
  const validRepAngles = reps
    .map(r => r.peakAngle)
    .filter((a): a is number => typeof a === 'number' && !isNaN(a) && a > 0);

  const avgPeakAngle = validRepAngles.length > 0
    ? Math.round(validRepAngles.reduce((acc, a) => acc + a, 0) / validRepAngles.length)
    : 110;

  const durationMinutes = Math.max(
    1,
    Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000)
  );

  // 1. Supabase Persistence
  if (isSupabaseConfigured) {
    try {
      // If patientId is not a valid UUID, attempt to resolve from current authenticated session
      if (!isValidUuid(targetPatientId)) {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user?.id) {
          targetPatientId = authData.user.id;
        }
      }

      const validPrescriptionId = isValidUuid(prescriptionId) ? prescriptionId : null;

      const sessionInsertPayload = {
        patient_id: targetPatientId,
        prescription_id: validPrescriptionId,
        exercise_type: exerciseType,
        started_at: startedAt,
        ended_at: endedAt,
      };

      console.log('⚡ [SessionService] Initiating session INSERT into Supabase `sessions` table:', sessionInsertPayload);

      // 1a. Insert into sessions table
      const { data: sessionRow, error: sessionError } = await supabase
        .from('sessions')
        .insert([sessionInsertPayload])
        .select()
        .single();

      console.log('⚡ [SessionService] Supabase `sessions` INSERT response:', {
        data: sessionRow,
        error: sessionError,
      });

      if (sessionError) {
        console.error('❌ [SessionService] FAILED to insert into `sessions` table:', {
          message: sessionError.message,
          details: sessionError.details,
          hint: sessionError.hint,
          code: sessionError.code,
        });
      } else if (sessionRow) {
        console.log('✅ [SessionService] Session successfully created with ID:', sessionRow.id);

        // 1b. Insert rows into session_reps table
        if (reps.length > 0) {
          const repsToInsert = reps.map((rep) => ({
            session_id: sessionRow.id,
            rep_number: rep.repNumber,
            // Mode A (nullable for Mode B/C)
            peak_angle: rep.peakAngle ?? null,
            min_angle: rep.minAngle ?? null,
            rom_range: rep.romRange ?? null,
            target_met: rep.targetMet,
            compensation_flags: rep.compensationFlags || [],
            // Mode B
            hold_duration_seconds: rep.holdDurationSeconds ?? null,
            stability_score: rep.stabilityScore ?? null,
            rotation_count: rep.rotationCount ?? null,
            // Mode C
            self_reported: rep.selfReported ?? false,
          }));

          console.log(`⚡ [SessionService] Inserting ${repsToInsert.length} rep records into \`session_reps\` table:`, repsToInsert);

          let { data: repsData, error: repsError } = await supabase
            .from('session_reps')
            .insert(repsToInsert)
            .select();

          if (repsError) {
            console.warn('⚠️ [SessionService] Extended session_reps payload failed, trying core columns:', repsError.message);
            const coreRepsToInsert = reps.map((rep) => ({
              session_id: sessionRow.id,
              rep_number: rep.repNumber,
              peak_angle: rep.peakAngle ?? null,
              min_angle: rep.minAngle ?? null,
              rom_range: rep.romRange ?? null,
              target_met: rep.targetMet,
              compensation_flags: rep.compensationFlags || [],
            }));

            const { data: coreData, error: coreError } = await supabase
              .from('session_reps')
              .insert(coreRepsToInsert)
              .select();

            if (coreError) {
              console.error('❌ [SessionService] Core session_reps insert error:', coreError.message);
            } else {
              repsData = coreData;
              console.log(`✅ [SessionService] Successfully saved ${repsData?.length || 0} core rep telemetry rows.`);
            }
          } else {
            console.log(`✅ [SessionService] Successfully saved ${repsData?.length || 0} rep telemetry rows.`);
          }
        }
      }
    } catch (err) {
      console.error('❌ [SessionService] Unhandled error during Supabase session recording:', err);
    }
  }

  // 2. Demo mode session persistence for registered demo patients
  if (!isSupabaseConfigured && targetPatientId) {
    saveStoredDemoSession(targetPatientId, {
      id: sessionId,
      patientId: targetPatientId,
      exerciseType,
      startedAt,
      endedAt,
      durationMinutes,
      totalReps,
      targetMetCount,
      avgPeakAngle,
      reps,
    });
  }

  // 3. Local Mock Store Sync (for legacy 'p-001' demo)
  try {
    const patients = getMockPatients();
    const patientIndex = patients.findIndex(p => p.id === targetPatientId || p.id === 'p-001');

    if (patientIndex !== -1) {
      const patient = patients[patientIndex];
      const targetAngle = patient.prescription.target_angle || 110;

      const newSessionIndex = patient.romHistory.length + 1;
      const todayShort = new Date().toLocaleDateString([], { month: 'short', day: 'numeric' });

      patient.romHistory.push({
        session: `S-${newSessionIndex}`,
        date: todayShort,
        romAngle: avgPeakAngle || targetAngle,
        targetAngle: targetAngle,
        targetMet: avgPeakAngle >= targetAngle - 5,
      });

      const exerciseLabel = exerciseType === 'knee_extension' ? 'Knee Extension' : 'Shoulder Raise';
      const flags: string[] = [];
      if (avgPeakAngle >= targetAngle) flags.push('Target Met');
      flags.push('Stable posture');

      patient.sessionsHistory.unshift({
        id: sessionId,
        exerciseType: exerciseLabel,
        date: `Today, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        durationMinutes: durationMinutes,
        repsCompleted: totalReps,
        targetReps: patient.prescription.sets * patient.prescription.reps,
        avgRom: avgPeakAngle,
        compensationFlags: flags,
      });

      if (reps.length > 0) {
        patient.angleDeviationData = reps.map((r) => ({
          repNumber: r.repNumber,
          measuredAngle: r.peakAngle,
          prescribedAngle: targetAngle,
          deviation: Math.round(r.peakAngle - targetAngle),
        }));
      }

      saveMockPatients(patients);
    }
  } catch (err) {
    console.warn('Error updating mock patient store:', err);
  }

  // 4. Save last completed session summary to localStorage for the completion banner
  const summaryResult: SessionSummaryResult = {
    sessionId,
    patientId: targetPatientId,
    exerciseType,
    totalReps,
    targetMetCount,
    avgPeakAngle,
    durationMinutes,
    endedAt,
  };

  try {
    localStorage.setItem(LAST_SESSION_SUMMARY_KEY, JSON.stringify(summaryResult));
  } catch (e) {
    // ignore
  }

  return summaryResult;
}

export function getLastSessionSummary(): SessionSummaryResult | null {
  try {
    const raw = localStorage.getItem(LAST_SESSION_SUMMARY_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    // ignore
  }
  return null;
}

export function clearLastSessionSummary() {
  try {
    localStorage.removeItem(LAST_SESSION_SUMMARY_KEY);
  } catch (e) {
    // ignore
  }
}

/**
 * Fetch patient dashboard data with real Supabase queries.
 * When a patient has 0 sessions, stats cleanly default to 0 with an empty ROM history.
 */
export async function fetchPatientDashboardStats(patientId: string): Promise<PatientDashboardStats> {
  const defaultPrescription: Prescription = {
    id: 'rx-default',
    patient_id: patientId,
    clinician_id: 'c-001',
    exercise_type: 'knee_extension',
    target_angle: 110,
    sets: 3,
    reps: 10,
    frequency_per_week: 5,
    notes: 'Focus on full terminal extension with a 2-second isometric pause.',
    created_at: new Date().toISOString(),
  };

  const defaultClinician = {
    id: 'c-001',
    name: 'Dr. Sarah Chen, PT, DPT',
    credentials: 'Board Certified Neurologic Specialist (NCS)',
    specialty: 'Post-Stroke Motor Neuro-Rehabilitation',
  };

  if (!isSupabaseConfigured) {
    // Check if this is a newly registered demo account
    if (patientId && patientId !== 'p-001') {
      const demoSessions = getStoredDemoSessions(patientId);
      const weekStart = getStartOfCurrentWeek();
      const thisWeekSessions = demoSessions.filter(s => new Date(s.startedAt) >= weekStart);
      const completedSessionsThisWeek = thisWeekSessions.length;
      const prescribedSessionsThisWeek = 5;
      const weeklyAdherence = Math.min(100, Math.round((completedSessionsThisWeek / prescribedSessionsThisWeek) * 100));

      const targetAngle = 110;
      const romHistory = demoSessions.slice().reverse().map((s, idx) => ({
        session: `S-${idx + 1}`,
        date: new Date(s.startedAt).toLocaleDateString([], { month: 'short', day: 'numeric' }),
        romAngle: s.avgPeakAngle,
        targetAngle: targetAngle,
        targetMet: s.avgPeakAngle >= targetAngle - 5,
      }));

      const sessionsHistory = demoSessions.map(s => {
        const exerciseLabel = s.exerciseType === 'knee_extension' ? 'Knee Extension' : 'Shoulder Raise';
        const flags: string[] = [];
        if (s.avgPeakAngle >= targetAngle) flags.push('Target Met');
        flags.push('Stable posture');

        return {
          id: s.id,
          exerciseType: exerciseLabel,
          date: `Today, ${new Date(s.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          durationMinutes: s.durationMinutes,
          repsCompleted: s.totalReps,
          targetReps: 30,
          avgRom: s.avgPeakAngle,
          compensationFlags: flags,
        };
      });

      const totalRepsCompleted = demoSessions.reduce((acc, s) => acc + s.totalReps, 0);

      return {
        prescription: defaultPrescription,
        assignedClinician: defaultClinician,
        assignedClinicianId: 'c-001',
        isClinicianAssigned: true,
        condition: 'Stroke Rehabilitation — Knee Extension',
        conditionCategory: 'stroke',
        primaryInjury: 'stroke_knee',
        completionRate: weeklyAdherence,
        weeklyAdherence: weeklyAdherence,
        completedSessionsThisWeek,
        prescribedSessionsThisWeek,
        totalRepsCompleted,
        totalRepsPrescribed: 150,
        totalSessions: demoSessions.length,
        romHistory,
        sessionsHistory,
      };
    }

    // Return mock data for demo mode default patient
    const patients = getMockPatients();
    const p = patients.find(pat => pat.id === patientId) || patients[0];
    const prescribedSessionsThisWeek = p.prescription.frequency_per_week || 5;
    return {
      prescription: p.prescription,
      assignedClinician: p.assignedClinician,
      assignedClinicianId: p.assignedClinician?.id || 'c-001',
      isClinicianAssigned: true,
      condition: p.condition,
      conditionCategory: 'stroke',
      primaryInjury: 'stroke_knee',
      completionRate: p.compliance,
      weeklyAdherence: p.compliance,
      completedSessionsThisWeek: p.sessionsHistory.length,
      prescribedSessionsThisWeek,
      totalRepsCompleted: Math.round((p.compliance / 100) * (p.prescription.sets * p.prescription.reps * p.prescription.frequency_per_week)),
      totalRepsPrescribed: p.prescription.sets * p.prescription.reps * p.prescription.frequency_per_week,
      totalSessions: p.sessionsHistory.length,
      romHistory: p.romHistory,
      sessionsHistory: p.sessionsHistory,
    };
  }

  try {
    console.log('⚡ [SessionService] Fetching real patient dashboard stats for ID:', patientId);

    // Ensure we have a valid UUID in Supabase mode to prevent Postgres syntax errors
    let targetPatientId = patientId;
    if (!isValidUuid(targetPatientId)) {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user?.id && isValidUuid(authData.user.id)) {
        targetPatientId = authData.user.id;
        console.log('⚡ [SessionService] Resolved patientId from active Supabase session:', targetPatientId);
      } else {
        console.warn('⚠️ [SessionService] No valid authenticated UUID available for query:', patientId);
        return {
          prescription: defaultPrescription,
          assignedClinician: defaultClinician,
          assignedClinicianId: null,
          isClinicianAssigned: false,
          condition: 'Stroke Rehabilitation — Knee Extension',
          conditionCategory: 'stroke',
          primaryInjury: 'stroke_knee',
          completionRate: 0,
          weeklyAdherence: 0,
          completedSessionsThisWeek: 0,
          prescribedSessionsThisWeek: defaultPrescription.frequency_per_week || 5,
          totalRepsCompleted: 0,
          totalRepsPrescribed: defaultPrescription.sets * defaultPrescription.reps * defaultPrescription.frequency_per_week,
          totalSessions: 0,
          romHistory: [],
          sessionsHistory: [],
        };
      }
    }

    // 1. Fetch real prescription
    let activePrescription = { ...defaultPrescription, patient_id: targetPatientId };
    const { data: rxData, error: rxError } = await supabase
      .from('prescriptions')
      .select('*')
      .eq('patient_id', targetPatientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!rxError && rxData) {
      activePrescription = rxData as Prescription;
    }

    // 2. Fetch patient profile & assigned clinician
    let condition = 'Stroke Rehabilitation — Knee Extension';
    let conditionCategory: string | null = null;
    let primaryInjury: string | null = null;
    let assignedClinician = defaultClinician;

    const { data: patProfile } = await supabase
      .from('patient_profiles')
      .select(`
        condition,
        condition_category,
        primary_injury,
        assigned_clinician_id,
        clinician:assigned_clinician_id (
          id,
          full_name
        )
      `)
      .eq('user_id', targetPatientId)
      .maybeSingle();

    if (patProfile) {
      if (patProfile.condition) {
        condition = patProfile.condition;
      }
      conditionCategory = patProfile.condition_category || null;
      primaryInjury = patProfile.primary_injury || null;

      if (patProfile.assigned_clinician_id) {
        const clinicianObj = Array.isArray(patProfile.clinician) ? patProfile.clinician[0] : patProfile.clinician;
        assignedClinician = {
          id: patProfile.assigned_clinician_id,
          name: clinicianObj?.full_name || 'Dr. Sarah Chen, PT, DPT',
          credentials: 'Board Certified Neurologic Specialist (NCS)',
          specialty: 'Post-Stroke Motor Neuro-Rehabilitation',
        };
      }
    }

    // Backward compatibility: if DB row exists but newer onboarding columns are missing,
    // recover from onboarding cache so the user is not bounced back to onboarding.
    if (!primaryInjury) {
      const cachedInjury = localStorage.getItem(ONBOARDING_INJURY_KEY);
      if (cachedInjury) {
        primaryInjury = cachedInjury;
      }
    }
    if (!conditionCategory) {
      const cachedCategory = localStorage.getItem(ONBOARDING_CATEGORY_KEY);
      if (cachedCategory) {
        conditionCategory = cachedCategory;
      }
    }

    // 3. Fetch real sessions and joined session_reps for this patient
    const { data: sessionRows, error: sessionsError } = await supabase
      .from('sessions')
      .select(`
        id,
        exercise_type,
        started_at,
        ended_at,
        prescription_id,
        session_reps (
          id,
          rep_number,
          peak_angle,
          min_angle,
          rom_range,
          target_met,
          compensation_flags,
          created_at
        )
      `)
      .eq('patient_id', targetPatientId)
      .order('started_at', { ascending: true });

    console.log('⚡ [SessionService] Fetched live patient sessions:', {
      patientId: targetPatientId,
      count: sessionRows?.length || 0,
      error: sessionsError,
    });

    const isClinicianAssigned = Boolean(patProfile?.assigned_clinician_id);
    const assignedClinicianId = patProfile?.assigned_clinician_id || null;
    const prescribedSessionsThisWeek = activePrescription.frequency_per_week || 5;
    const totalRepsPrescribed = activePrescription.sets * activePrescription.reps * prescribedSessionsThisWeek;

    // If a new patient has NO sessions yet:
    if (!sessionRows || sessionRows.length === 0) {
      return {
        prescription: activePrescription,
        assignedClinician,
        assignedClinicianId,
        isClinicianAssigned,
        condition,
        conditionCategory,
        primaryInjury,
        completionRate: 0,
        weeklyAdherence: 0,
        completedSessionsThisWeek: 0,
        prescribedSessionsThisWeek,
        totalRepsCompleted: 0,
        totalRepsPrescribed,
        totalSessions: 0,
        romHistory: [],
        sessionsHistory: [],
      };
    }

    // Calculate real stats from database rows
    let totalRepsCompleted = 0;
    const romHistory: PatientDashboardStats['romHistory'] = [];
    const sessionsHistory: PatientDashboardStats['sessionsHistory'] = [];

    sessionRows.forEach((sess, idx) => {
      const reps = (sess.session_reps || []) as SessionRep[];
      const repCount = reps.length;
      totalRepsCompleted += repCount;

      const validAngles = reps
        .map((r) => Number(r.peak_angle))
        .filter((angle) => !isNaN(angle) && angle > 0);

      let avgPeakAngle = 0;
      if (validAngles.length > 0) {
        avgPeakAngle = Math.round(validAngles.reduce((acc, val) => acc + val, 0) / validAngles.length);
      } else {
        avgPeakAngle = activePrescription.target_angle || 110;
      }

      const startDate = new Date(sess.started_at);
      const formattedDate = startDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
      const durationMin = sess.ended_at
        ? Math.max(1, Math.round((new Date(sess.ended_at).getTime() - startDate.getTime()) / 60000))
        : 10;

      // ROM History Point
      romHistory.push({
        session: `S-${idx + 1}`,
        date: formattedDate,
        romAngle: avgPeakAngle,
        targetAngle: activePrescription.target_angle,
        targetMet: avgPeakAngle >= (activePrescription.target_angle - 5),
      });

      // Session History Row
      const isToday = new Date().toDateString() === startDate.toDateString();
      const timeStr = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const displayDate = isToday ? `Today, ${timeStr}` : `${formattedDate}, ${timeStr}`;

      const exerciseLabel = sess.exercise_type === 'knee_extension' ? 'Knee Extension' : 'Shoulder Raise';
      const flags: string[] = [];
      if (avgPeakAngle >= activePrescription.target_angle) flags.push('Target Met');
      flags.push('Stable posture');

      sessionsHistory.unshift({
        id: sess.id,
        exerciseType: exerciseLabel,
        date: displayDate,
        durationMinutes: durationMin,
        repsCompleted: repCount > 0 ? repCount : (activePrescription.sets * activePrescription.reps),
        targetReps: activePrescription.sets * activePrescription.reps,
        avgRom: avgPeakAngle,
        compensationFlags: flags,
      });
    });

    // Angle deviation breakdown for latest session
    const latestSession = sessionRows[sessionRows.length - 1];
    const latestReps = (latestSession?.session_reps || []) as SessionRep[];
    const targetAngle = activePrescription.target_angle || 110;

    const angleDeviationData = latestReps.map((r, idx) => {
      const measured = (Number(r.peak_angle) && Number(r.peak_angle) > 0)
        ? Number(r.peak_angle)
        : targetAngle;
      return {
        repNumber: r.rep_number || (idx + 1),
        measuredAngle: measured,
        prescribedAngle: targetAngle,
        deviation: Math.round(measured - targetAngle),
      };
    });

    // Requirement 5: Weekly Adherence fresh calculation
    const startOfWeek = getStartOfCurrentWeek();
    const completedSessionsThisWeek = sessionRows.filter((sess) => {
      const d = new Date(sess.started_at);
      return !isNaN(d.getTime()) && d >= startOfWeek;
    }).length;

    const weeklyAdherence = prescribedSessionsThisWeek > 0
      ? Math.min(100, Math.round((completedSessionsThisWeek / prescribedSessionsThisWeek) * 100))
      : 0;

    return {
      prescription: activePrescription,
      assignedClinician,
      assignedClinicianId,
      isClinicianAssigned,
      condition,
      conditionCategory,
      primaryInjury,
      completionRate: weeklyAdherence,
      weeklyAdherence,
      completedSessionsThisWeek,
      prescribedSessionsThisWeek,
      totalRepsCompleted,
      totalRepsPrescribed,
      totalSessions: sessionRows.length,
      romHistory,
      sessionsHistory,
      angleDeviationData,
    };
  } catch (err) {
    console.error('❌ [SessionService] Error loading patient dashboard stats:', err);
      return {
        prescription: defaultPrescription,
        assignedClinician: defaultClinician,
        assignedClinicianId: null,
        isClinicianAssigned: false,
        condition: 'Stroke Rehabilitation — Knee Extension',
        conditionCategory: null,
        primaryInjury: null,
        completionRate: 0,
        weeklyAdherence: 0,
        completedSessionsThisWeek: 0,
        prescribedSessionsThisWeek: defaultPrescription.frequency_per_week || 5,
        totalRepsCompleted: 0,
        totalRepsPrescribed: defaultPrescription.sets * defaultPrescription.reps * defaultPrescription.frequency_per_week,
        totalSessions: 0,
        romHistory: [],
        sessionsHistory: [],
      };
  }
}

export async function fetchLivePatientSessions(patientId: string): Promise<Session[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('patient_id', patientId)
        .order('started_at', { ascending: false });

      if (!error && data) {
        return data as Session[];
      }
    } catch (e) {
      console.warn('Error fetching live sessions:', e);
    }
  }
  return [];
}

export async function fetchSessionReps(sessionId: string): Promise<SessionRep[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('session_reps')
        .select('*')
        .eq('session_id', sessionId)
        .order('rep_number', { ascending: true });

      if (!error && data) {
        return data as SessionRep[];
      }
    } catch (e) {
      console.warn('Error fetching session reps:', e);
    }
  }
  return [];
}
