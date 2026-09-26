import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import {
  fetchPatientDashboardStats,
  getLastSessionSummary,
  clearLastSessionSummary
} from '../lib/sessionService';
import type { PatientDashboardStats, SessionSummaryResult } from '../lib/sessionService';
import {
  fetchAvailableClinicians,
  assignClinicianToPatient,
  type ClinicianOption
} from '../lib/clinicianService';
import { getInjuryConfig } from '../lib/injuryConfig';
import {
  Play,
  MessageSquare,
  Calendar,
  Target,
  Award,
  TrendingUp,
  Sparkles,
  Stethoscope,
  CheckCircle2,
  Info,
  ShieldCheck,
  Flame,
  Bell,
  X,
  ArrowRight,
  Zap,
  Activity,
  AlertTriangle,
  UserCheck,
  Video
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { MessageModal } from '../components/modals/MessageModal';
import { AppointmentModal } from '../components/modals/AppointmentModal';
import { ExerciseLaunchModal } from '../components/modals/ExerciseLaunchModal';
import { PaymentModal } from '../components/modals/PaymentModal';
import { VideoCallModal } from '../components/modals/VideoCallModal';

export const PatientDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile, user, isSupabaseConfigured } = useAuth();
  const { t } = useTranslation();

  // Requirement 3: Use real user UUID in Supabase mode and avoid invalid 'p-001' query fallback
  const resolvedPatientId = user?.id || profile?.id;
  const effectivePatientId = isSupabaseConfigured
    ? (resolvedPatientId || '')
    : (resolvedPatientId || 'p-001');

  // Live database state
  const [loading, setLoading] = useState<boolean>(true);
  const [dashboardStats, setDashboardStats] = useState<PatientDashboardStats | null>(null);
  const [lastSummary, setLastSummary] = useState<SessionSummaryResult | null>(null);

  // Available clinicians for inline assignment
  const [availableClinicians, setAvailableClinicians] = useState<ClinicianOption[]>([]);
  const [selectedClinicianToAssign, setSelectedClinicianToAssign] = useState<string>('');
  const [assigningClinician, setAssigningClinician] = useState<boolean>(false);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);

  // Modals state
  const [isMessageModalOpen, setMessageModalOpen] = useState(false);
  const [isAppointmentModalOpen, setAppointmentModalOpen] = useState(false);
  const [isLaunchModalOpen, setLaunchModalOpen] = useState(false);
  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
  const [isVideoModalOpen, setVideoModalOpen] = useState(false);
  const [reminderDismissed, setReminderDismissed] = useState(false);

  // Load clinicians for assign dropdown
  useEffect(() => {
    fetchAvailableClinicians().then((list) => {
      setAvailableClinicians(list);
      if (list.length > 0) {
        setSelectedClinicianToAssign(list[0].id);
      }
    });
  }, []);

  // Sync state on load & when focus returns
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (isSupabaseConfigured && !effectivePatientId) {
        // Wait for authenticated user session to resolve
        return;
      }

      setLoading(true);
      const data = await fetchPatientDashboardStats(effectivePatientId);
      if (isMounted) {
        // Explicit log of the logged-in patient's assigned_clinician_id on dashboard load
        console.log('⚡ [PatientDashboard] Logged-in patient assigned_clinician_id:', data.assignedClinicianId);
        console.log('⚡ [PatientDashboard] Loaded patient profile:', {
          patientId: effectivePatientId,
          assigned_clinician_id: data.assignedClinicianId,
          isClinicianAssigned: data.isClinicianAssigned,
          clinicianName: data.assignedClinician.name,
          weeklyAdherence: data.weeklyAdherence,
        });

        // Redirect to onboarding if primary injury is missing
        if (!data.primaryInjury) {
          navigate('/patient/onboarding');
          return;
        }

        setDashboardStats(data);
        setLoading(false);
      }
    }

    loadData();

    const isRecorded = searchParams.get('session_recorded');
    if (isRecorded) {
      const summary = getLastSessionSummary();
      if (summary) {
        setLastSummary(summary);
      }
    }

    const handleFocus = () => {
      if (isSupabaseConfigured && !effectivePatientId) return;
      fetchPatientDashboardStats(effectivePatientId).then((data) => {
        if (isMounted) {
          console.log('⚡ [PatientDashboard Focus] Refreshed patient profile:', {
            patientId: effectivePatientId,
            assigned_clinician_id: data.assignedClinicianId,
            weeklyAdherence: data.weeklyAdherence,
          });
          if (!data.primaryInjury) {
            navigate('/patient/onboarding');
            return;
          }
          setDashboardStats(data);
        }
      });
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleFocus);
    };
  }, [effectivePatientId, searchParams, isSupabaseConfigured]);

  // Handle assigning a doctor to an existing unassigned patient
  const handleAssignClinician = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClinicianToAssign) return;

    setAssigningClinician(true);
    const res = await assignClinicianToPatient(effectivePatientId, selectedClinicianToAssign);

    if (res.success) {
      setAssignSuccess('Doctor successfully assigned! Refreshing telemetry...');
      const freshData = await fetchPatientDashboardStats(effectivePatientId);
      setDashboardStats(freshData);
      setTimeout(() => setAssignSuccess(null), 3000);
    } else {
      alert('Error assigning clinician: ' + res.error);
    }
    setAssigningClinician(false);
  };

  const prescription = dashboardStats?.prescription || {
    id: 'rx-default',
    patient_id: effectivePatientId,
    clinician_id: 'c-001',
    exercise_type: 'knee_extension',
    target_angle: 110,
    sets: 3,
    reps: 10,
    frequency_per_week: 5,
    notes: 'Focus on smooth controlled movement.',
    created_at: new Date().toISOString(),
  };

  const assignedClinician = dashboardStats?.assignedClinician || {
    id: 'c-001',
    name: 'Dr. Sarah Chen, PT, DPT',
    credentials: 'Board Certified Neurologic Specialist (NCS)',
    specialty: 'Post-Stroke Motor Neuro-Rehabilitation',
  };

  const isClinicianAssigned = dashboardStats?.isClinicianAssigned ?? true;
  const patientDisplayName = profile?.full_name || 'Patient';
  const injuryConfig = getInjuryConfig(dashboardStats?.primaryInjury);
  const condition = injuryConfig.badgeLabel;
  const exerciseNameFormatted = prescription.exercise_type === 'knee_extension'
    ? 'Seated Knee Extension'
    : prescription.exercise_type === 'shoulder_raise'
    ? 'Active Shoulder Raise'
    : prescription.exercise_type === 'ankle_mobility'
    ? 'Ankle Mobility'
    : 'Leg Raise';

  // Weekly Adherence calculation from real queries (Requirement 5)
  const weeklyAdherence = dashboardStats?.weeklyAdherence ?? dashboardStats?.completionRate ?? 0;
  const completedSessionsThisWeek = dashboardStats?.completedSessionsThisWeek ?? 0;
  const prescribedSessionsThisWeek = dashboardStats?.prescribedSessionsThisWeek ?? (prescription.frequency_per_week || 5);
  const totalRepsCompleted = dashboardStats?.totalRepsCompleted || 0;
  const totalRepsPrescribed = dashboardStats?.totalRepsPrescribed || (prescription.sets * prescription.reps * (prescription.frequency_per_week || 5));
  const romHistory = dashboardStats?.romHistory || [];
  const totalSessions = dashboardStats?.totalSessions || 0;

  // Session reminder check
  const reminderInfo = useMemo(() => {
    const freq = prescription.frequency_per_week || 5;
    const expectedIntervalDays = Math.max(1, Math.round(7 / freq));

    const hasSessionToday = lastSummary !== null || (dashboardStats?.sessionsHistory[0]?.date.includes('Today') && !reminderDismissed);
    const isNew = totalSessions === 0;
    const isOverdue = !hasSessionToday;

    return {
      isNew,
      isOverdue,
      expectedIntervalDays,
      prescribedFrequency: freq,
    };
  }, [prescription, lastSummary, dashboardStats?.sessionsHistory, reminderDismissed, totalSessions]);

  if (loading && !dashboardStats) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 flex flex-col items-center justify-center space-y-4">
        <Activity className="w-10 h-10 text-teal-600 animate-spin" />
        <p className="text-slate-600 font-bold text-base">Loading telemetry & patient portal...</p>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">

      {/* 0. Prompt for Unassigned Clinician (Fix for existing test accounts) */}
      {!isClinicianAssigned && (
        <section
          className="bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-3xl p-6 sm:p-8 shadow-xl border-2 border-amber-400 flex flex-col lg:flex-row lg:items-center justify-between gap-6 animate-in slide-in-from-top-4"
          role="alert"
        >
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 border border-white/30 text-white">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-900/60 text-amber-200 text-xs font-black uppercase tracking-wider mb-1">
                {t('dashboard.doctor_not_linked', 'Doctor Not Linked')}
              </div>
              <h2 className="text-xl sm:text-2xl font-black">
                {t('dashboard.assign_doctor_title', 'Assign Your Physical Therapist to Link Your Care')}
              </h2>
              <p className="text-xs sm:text-sm text-amber-100 font-medium max-w-2xl mt-1">
                {t('dashboard.assign_doctor_desc', 'Your account is currently not assigned to a doctor. Link your clinician below so your telemetry synchronizes to their caseload and 1-to-1 secure chat is enabled.')}
              </p>
              {assignSuccess && (
                <p className="text-xs font-bold text-emerald-100 bg-emerald-800/80 px-3 py-1 rounded-xl mt-2 inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" /> {assignSuccess}
                </p>
              )}
            </div>
          </div>

          <form onSubmit={handleAssignClinician} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <select
              value={selectedClinicianToAssign}
              onChange={(e) => setSelectedClinicianToAssign(e.target.value)}
              className="px-4 py-3 bg-white text-slate-900 text-sm font-bold rounded-2xl border-2 border-amber-300 focus:outline-none focus:ring-2 focus:ring-white cursor-pointer"
            >
              {availableClinicians.length === 0 ? (
                <option value="c-001">Dr. Sarah Chen, PT, DPT</option>
              ) : (
                availableClinicians.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.specialty})
                  </option>
                ))
              )}
            </select>
            <button
              type="submit"
              disabled={assigningClinician}
              className="px-6 py-3 rounded-2xl bg-slate-950 hover:bg-slate-900 text-white font-black text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {assigningClinician ? (
                <Activity className="w-4 h-4 animate-spin text-amber-400" />
              ) : (
                <UserCheck className="w-4 h-4 text-amber-400" />
              )}
              <span>{t('dashboard.assign_doctor_btn', 'Assign Doctor')}</span>
            </button>
          </form>
        </section>
      )}

      {/* Success Notification Banner for newly completed workout */}
      {lastSummary && (
        <section
          className="bg-emerald-600 text-white rounded-3xl p-5 sm:p-6 shadow-xl border-2 border-emerald-400 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/20 text-white flex items-center justify-center shrink-0 border border-white/30">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wide bg-emerald-800/80 px-2.5 py-0.5 rounded-full border border-emerald-400/40">
                  Telemetry Synced to Database
                </span>
                <span className="text-xs text-emerald-100 font-bold">
                  {lastSummary.durationMinutes}m Session
                </span>
              </div>
              <h2 className="text-xl font-black mt-1">
                Workout Successfully Logged!
              </h2>
              <p className="text-xs sm:text-sm text-emerald-100 font-semibold mt-0.5">
                Completed <strong>{lastSummary.totalReps} Reps</strong> ({lastSummary.targetMetCount} met clinical target) with an average peak angle of <strong>{lastSummary.avgPeakAngle}°</strong>. Your doctor can now review your kinematics.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setLastSummary(null);
              clearLastSessionSummary();
            }}
            type="button"
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors self-end sm:self-center cursor-pointer"
            title="Dismiss notification"
            aria-label="Dismiss notification"
          >
            <X className="w-5 h-5" />
          </button>
        </section>
      )}

      {/* 1. Header Banner showing Patient Name & Assigned Clinician */}
      <section className="bg-gradient-to-r from-teal-800 via-teal-900 to-slate-900 rounded-3xl p-6 sm:p-10 text-white shadow-xl border-2 border-teal-700/50 relative overflow-hidden">
        <div className="absolute -right-12 -bottom-12 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-teal-500/20 text-teal-200 text-xs sm:text-sm font-bold backdrop-blur-sm border border-teal-400/30">
              <Sparkles className="w-4 h-4 text-teal-300" /> {t('dashboard.patient_portal', 'NeuroFlex Patient Portal')}
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white">
              {t('dashboard.hello', 'Hello, ')}{patientDisplayName}
            </h1>

            <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-teal-100 text-sm sm:text-base font-medium">
              <span className="flex items-center gap-1.5 bg-teal-950/60 px-3 py-1 rounded-xl border border-teal-700/50">
                <Stethoscope className="w-4 h-4 text-teal-300" />
                {t('dashboard.assigned_clinician', 'Assigned Clinician:')} <strong className="text-white font-bold">{assignedClinician.name}</strong>
              </span>
              <span className="flex items-center gap-1.5 text-teal-200 text-xs sm:text-sm bg-teal-950/60 px-3 py-1 rounded-xl border border-teal-700/50">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> {condition}
              </span>
              <button 
                onClick={() => navigate('/patient/onboarding')}
                className="text-xs sm:text-sm font-semibold text-teal-200 hover:text-white underline underline-offset-4 cursor-pointer"
              >
                Change condition
              </button>
            </div>
          </div>

          {/* Prominent Action Button: Start Exercise Session */}
          <div className="shrink-0">
            <button
              onClick={() => setLaunchModalOpen(true)}
              type="button"
              className="w-full sm:w-auto min-h-[64px] px-8 py-4 rounded-2xl bg-teal-400 hover:bg-teal-300 active:bg-teal-500 text-slate-950 text-xl font-black shadow-lg shadow-teal-500/25 transition-all flex items-center justify-center gap-3 focus:ring-4 focus:ring-teal-200 active:scale-[0.98] cursor-pointer"
              aria-label={t('dashboard.start_session', 'Start Exercise Session')}
            >
              <Play className="w-6 h-6 fill-slate-950 stroke-slate-950" />
              <span>{t('dashboard.start_session', 'Start Exercise Session')}</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. Automated Session Reminder Banner */}
      {reminderInfo.isOverdue && !reminderDismissed && (
        <section
          className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-5 sm:p-6 text-amber-950 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in"
          role="alert"
          aria-live="polite"
        >
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-200/80 text-amber-900 flex items-center justify-center shrink-0 border border-amber-300">
              <Bell className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wide bg-amber-200 text-amber-900 px-2 py-0.5 rounded">
                  {reminderInfo.isNew ? 'First Session Ready' : 'Therapy Due Reminder'}
                </span>
                <span className="text-xs font-bold text-amber-800">
                  Target: {prescription.frequency_per_week} sessions/week
                </span>
              </div>
              <h2 className="text-lg font-black text-amber-950 mt-1">
                {reminderInfo.isNew
                  ? t('dashboard.welcome_new', 'Welcome! You have not completed your first rehabilitation session yet.')
                  : 'You have not completed a rehab session today.'}
              </h2>
              <p className="text-xs sm:text-sm text-amber-900 font-medium mt-0.5">
                Complete your prescribed {exerciseNameFormatted} routine to begin recording your kinematics and range of motion.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => navigate(`/patient/exercise-session?exercise=${prescription.exercise_type}`)}
              type="button"
              className="touch-target px-5 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-sm transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <span>{t('dashboard.start_session_now', 'Start Session Now')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setReminderDismissed(true)}
              type="button"
              className="p-2 rounded-xl text-amber-700 hover:bg-amber-100 touch-target transition-colors cursor-pointer"
              title="Dismiss reminder"
              aria-label="Dismiss reminder"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </section>
      )}

      {/* 3. Top Stats & Today's Prescription Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Stat Card: Weekly Adherence (Requirement 5) */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-200 shadow-md flex flex-col justify-between" aria-label="Weekly Adherence">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                Weekly Adherence
              </span>
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200">
                <Award className="w-5 h-5" />
              </div>
            </div>

            <div className="flex items-baseline gap-3">
              <span className="text-5xl font-black text-slate-900">{weeklyAdherence}%</span>
              <span className={`text-xs sm:text-sm font-bold px-2.5 py-1 rounded-full border flex items-center gap-1 ${weeklyAdherence > 0
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : 'text-slate-600 bg-slate-100 border-slate-200'
                }`}>
                <TrendingUp className="w-3.5 h-3.5" />
                {weeklyAdherence > 0 ? t('dashboard.live_synced', 'Live Synced') : t('dashboard.no_sessions_yet', 'No Sessions Yet')}
              </span>
            </div>

            <p className="text-slate-600 text-base font-semibold mt-3">
              {t('dashboard.prescribed_completed_percent', { percent: weeklyAdherence, defaultValue: '{{percent}}% of prescribed sessions completed this week' })}
            </p>
          </div>

          <div className="mt-6 space-y-2">
            <div className="flex justify-between text-xs font-bold text-slate-500">
              <span>{t('dashboard.completed_sessions', { completed: completedSessionsThisWeek, prescribed: prescribedSessionsThisWeek, defaultValue: '{{completed}} of {{prescribed}} sessions completed' })}</span>
              <span>{t('dashboard.goal_sessions', { prescribed: prescribedSessionsThisWeek, defaultValue: 'Goal: {{prescribed}} sessions' })}</span>
            </div>
            <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden p-0.5 border border-slate-200">
              <div
                className="bg-teal-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, weeklyAdherence)}%` }}
              />
            </div>
          </div>
        </section>

        {/* Prescription Card: Today's Prescription */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-sky-200 shadow-md lg:col-span-2 flex flex-col justify-between" aria-label="Today's Prescription">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center border border-sky-200">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-sky-700 uppercase tracking-wider block">{t('dashboard.prescribed_regimen', 'Prescribed Regimen')}</span>
                  <h2 className="text-2xl font-black text-slate-900 leading-tight">{t('dashboard.todays_prescription', "Today's Prescription")}</h2>
                </div>
              </div>
              <span className="bg-sky-100 text-sky-900 text-xs sm:text-sm font-bold px-3 py-1 rounded-full border border-sky-300">
                {t('dashboard.per_week', { freq: prescription.frequency_per_week, defaultValue: '{{freq}}x Per Week' })}
              </span>
            </div>

            {/* Exercise Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
              <div className="bg-sky-50/60 p-3.5 rounded-2xl border border-sky-100">
                <div className="text-xs font-bold text-slate-500">{t('dashboard.exercise', 'Exercise')}</div>
                <div className="text-base font-black text-slate-900 mt-0.5">{exerciseNameFormatted}</div>
              </div>

              <div className="bg-sky-50/60 p-3.5 rounded-2xl border border-sky-100">
                <div className="text-xs font-bold text-slate-500">{t('dashboard.target_angle', 'Target Angle')}</div>
                <div className="text-base font-black text-teal-700 mt-0.5">{prescription.target_angle}°</div>
              </div>

              <div className="bg-sky-50/60 p-3.5 rounded-2xl border border-sky-100">
                <div className="text-xs font-bold text-slate-500">{t('dashboard.sets', 'Sets')}</div>
                <div className="text-base font-black text-slate-900 mt-0.5">{prescription.sets}</div>
              </div>

              <div className="bg-sky-50/60 p-3.5 rounded-2xl border border-sky-100">
                <div className="text-xs font-bold text-slate-500">{t('dashboard.reps_per_set', 'Reps per Set')}</div>
                <div className="text-base font-black text-slate-900 mt-0.5">{prescription.reps}</div>
              </div>
            </div>

            {/* Clinical Notes */}
            {prescription.notes && (
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-sm text-slate-700 flex items-start gap-2.5">
                <Info className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 font-bold">{t('dashboard.clinical_note', 'Clinical Note:')}</strong> {prescription.notes}
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>{t('dashboard.prescribed_by', { name: assignedClinician.name, defaultValue: `Prescribed by ${assignedClinician.name}` })}</span>
            <span className="font-semibold text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> {t('dashboard.ready_session', 'Ready for session')}
            </span>
          </div>
        </section>

      </div>

      {/* 4. Range of Motion (ROM) Trend Chart (Recharts or Clean Zero State) */}
      <section className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-200 shadow-md space-y-4" aria-label="Range of Motion Trend">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-teal-600" />
              <h2 className="text-2xl font-black text-slate-900">{t('dashboard.rom_trend', 'Range of Motion (ROM) Trend')}</h2>
            </div>
            <p className="text-slate-500 text-sm font-medium">
              {romHistory.length > 0
                ? t('dashboard.peak_angle_achieved', { count: romHistory.length, defaultValue: `Peak extension angle achieved across recorded rehabilitation sessions (${romHistory.length} Sessions)` })
                : t('dashboard.no_sessions_recorded', 'No rehabilitation sessions recorded yet for this patient.')}
            </p>
          </div>
          {romHistory.length > 0 && (
            <div className="flex items-center gap-4 text-xs font-bold">
              <span className="flex items-center gap-1.5 text-slate-700">
                <span className="w-3.5 h-3.5 rounded-full bg-teal-600 inline-block" /> {t('dashboard.measured_angle', 'Measured Angle (°)')}
              </span>
              <span className="flex items-center gap-1.5 text-amber-700">
                <span className="w-3.5 h-1 bg-amber-500 inline-block" /> {t('dashboard.prescribed_target', { target: prescription.target_angle, defaultValue: `Prescribed Target (${prescription.target_angle}°)` })}
              </span>
            </div>
          )}
        </div>

        {/* Dynamic Chart Display / Empty State */}
        {romHistory.length === 0 ? (
          <div className="h-64 sm:h-72 w-full flex flex-col items-center justify-center p-6 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-300 space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center border border-teal-200">
              <Activity className="w-7 h-7" />
            </div>
            <div className="max-w-md space-y-1">
              <h3 className="text-lg font-black text-slate-900">{t('dashboard.no_sessions_yet', 'No Sessions Yet')}</h3>
              <p className="text-xs sm:text-sm text-slate-600 font-medium">
                {t('dashboard.plot_explanation', 'Your joint angle telemetry and Range of Motion chart will automatically plot here as you complete workouts.')}
              </p>
            </div>
            <button
              onClick={() => setLaunchModalOpen(true)}
              type="button"
              className="touch-target px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-black shadow transition-all flex items-center gap-2 cursor-pointer mt-2"
            >
              <Play className="w-4 h-4 fill-white" /> {t('dashboard.start_first_session', 'Start First Session')}
            </button>
          </div>
        ) : (
          <div className="h-72 sm:h-80 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={romHistory} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  fontSize={13}
                  fontWeight={600}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 180]}
                  stroke="#64748b"
                  fontSize={13}
                  fontWeight={600}
                  tickFormatter={(val) => `${val}°`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 border border-slate-700">
                          <p className="font-bold text-teal-300">{data.date} ({data.session})</p>
                          <p className="text-sm font-black">Measured: {data.romAngle}°</p>
                          <p className="text-slate-300">Target Goal: {data.targetAngle}°</p>
                          <p className={`font-bold ${data.targetMet ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {data.targetMet ? '✓ Target Met' : 'Approaching Target'}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine
                  y={prescription.target_angle}
                  stroke="#f59e0b"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  label={{ value: `Goal: ${prescription.target_angle}°`, fill: '#b45309', fontSize: 12, position: 'top' }}
                />
                <Line
                  type="monotone"
                  dataKey="romAngle"
                  stroke="#0d9488"
                  strokeWidth={4}
                  dot={{ r: 6, fill: '#0d9488', stroke: '#ffffff', strokeWidth: 2 }}
                  activeDot={{ r: 9, fill: '#0f766e', stroke: '#ffffff', strokeWidth: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="bg-teal-50/70 p-4 rounded-2xl border border-teal-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm text-teal-900 font-semibold">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-500 shrink-0" />
            <span>
              {romHistory.length > 0 ? (
                <><strong>Live Progress:</strong> Peak ROM is tracking at <strong>{romHistory[romHistory.length - 1]?.romAngle}°</strong> with continuous telemetry sync.</>
              ) : (
                <><strong>Getting Started:</strong> Complete your first session to record your initial kinematics baseline.</>
              )}
            </span>
          </div>
          <span className="text-teal-700 font-bold flex items-center gap-1">
            <Zap className="w-4 h-4 text-amber-500" /> Real-time Telemetry
          </span>
        </div>
      </section>

      {/* 5. Practitioner Connect Section */}
      <section className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-200 shadow-md" aria-label="Practitioner Connect">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">

          <div className="flex items-start sm:items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-2xl border-2 border-emerald-300 shrink-0">
              {assignedClinician.name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('') || 'DR'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-2xl font-black text-slate-900">{assignedClinician.name}</h3>
                <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-300">
                  Assigned PT
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-600 mt-0.5">
                {assignedClinician.credentials}
              </p>
              <p className="text-xs text-slate-500 font-medium">
                Specialty: {assignedClinician.specialty}
              </p>
            </div>
          </div>

          {/* Action Buttons: Message, Book Appointment, Subscribe */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setMessageModalOpen(true)}
              type="button"
              className="touch-target px-5 py-3.5 rounded-2xl border-2 border-teal-600 bg-teal-50/70 hover:bg-teal-100 text-teal-900 text-base font-extrabold flex items-center justify-center gap-2 transition-colors focus:ring-4 focus:ring-teal-200 cursor-pointer"
              aria-label="Message your clinician"
            >
              <MessageSquare className="w-5 h-5 text-teal-700" />
              <span>Message</span>
            </button>

            <button
              onClick={() => setVideoModalOpen(true)}
              type="button"
              className="touch-target px-5 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-base font-extrabold shadow-md hover:shadow transition-all flex items-center justify-center gap-2 focus:ring-4 focus:ring-indigo-300 cursor-pointer"
              aria-label="Start Video Call"
            >
              <Video className="w-5 h-5" />
              <span>Start Video Call</span>
            </button>

            <button
              onClick={() => setAppointmentModalOpen(true)}
              type="button"
              className="touch-target px-6 py-3.5 rounded-2xl bg-teal-700 hover:bg-teal-800 text-white text-base font-extrabold shadow-md hover:shadow transition-all flex items-center justify-center gap-2 focus:ring-4 focus:ring-teal-300 cursor-pointer"
              aria-label="Book an appointment"
            >
              <Calendar className="w-5 h-5" />
              <span>Book Appointment</span>
            </button>

            <button
              onClick={() => setPaymentModalOpen(true)}
              type="button"
              className="touch-target px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-base font-extrabold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 focus:ring-4 focus:ring-indigo-300 cursor-pointer"
              aria-label="Subscribe to Continue Care"
            >
              <ShieldCheck className="w-5 h-5" />
              <span>Subscribe to Care</span>
            </button>
          </div>

        </div>
      </section>

      {/* Interactive Modals */}
      <MessageModal
        isOpen={isMessageModalOpen}
        onClose={() => setMessageModalOpen(false)}
        currentUserId={effectivePatientId}
        recipientId={assignedClinician.id || 'c-001'}
        recipientName={assignedClinician.name}
        recipientRole="Physical Therapist"
      />

      <AppointmentModal
        isOpen={isAppointmentModalOpen}
        onClose={() => setAppointmentModalOpen(false)}
        patientId={effectivePatientId}
        clinicianId={assignedClinician.id || 'c-001'}
        clinicianName={assignedClinician.name}
      />

      <ExerciseLaunchModal
        isOpen={isLaunchModalOpen}
        onClose={() => setLaunchModalOpen(false)}
        prescription={prescription}
      />

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        patientId={effectivePatientId}
        clinicianId={assignedClinician.id || 'c-001'}
      />

      <VideoCallModal
        isOpen={isVideoModalOpen}
        onClose={() => setVideoModalOpen(false)}
        roomName={`Neuroflex_Call_${effectivePatientId}_${assignedClinician.id || 'c-001'}`}
        userName={patientDisplayName}
      />

    </main>
  );
};

export default PatientDashboard;
