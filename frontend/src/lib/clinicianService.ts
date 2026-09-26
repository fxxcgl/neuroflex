import { fetchApi, API_BASE } from './api';
import { supabase, isSupabaseConfigured } from './supabase';
import { isValidUuid, fetchPatientDashboardStats } from './sessionService';
import { getMockPatients, saveMockPatients, updatePatientPrescription, type MockPatientDetail } from './mockData';
import type { Prescription, ExerciseType } from '../types';

export interface ClinicianOption {
  id: string;
  name: string;
  credentials: string;
  specialty: string;
  email?: string;
}

export async function fetchAvailableClinicians(): Promise<ClinicianOption[]> {
  if (API_BASE) {
    try {
      const data = await fetchApi('/clinicians');
      if (Array.isArray(data) && data.length > 0) {
        return data as ClinicianOption[];
      }
    } catch (err) {
      console.warn('⚡ [clinicianService] API fetch clinicians failed, trying Supabase fallback:', err);
    }
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, clinician_profiles(credentials, specialty)')
        .eq('role', 'clinician');

      if (!error && data && data.length > 0) {
        return data.map((c: any) => {
          const cp = Array.isArray(c.clinician_profiles) ? c.clinician_profiles[0] : c.clinician_profiles || {};
          const email = c.email || '';
          const name = c.full_name || (email ? `Dr. ${email.split('@')[0]}` : 'Dr. Clinician');
          return {
            id: c.id,
            name,
            credentials: cp.credentials || 'Licensed Physical Therapist',
            specialty: cp.specialty || 'Neurologic Physical Therapy',
            email,
          };
        });
      }
    } catch (err) {
      console.warn('⚡ [clinicianService] Supabase fetch clinicians warning:', err);
    }
  }

  return [
    {
      id: 'c-001',
      name: 'Dr. Sarah Chen, PT, DPT',
      credentials: 'Board Certified Neurologic Specialist (NCS)',
      specialty: 'Post-Stroke Motor Neuro-Rehabilitation',
      email: 'sarah.chen@neuroflex.health',
    },
  ];
}

export async function assignClinicianToPatient(
  patientId: string,
  clinicianId: string
): Promise<{ success: boolean; error?: string }> {
  if (API_BASE) {
    try {
      await fetchApi('/clinicians/assign', {
        method: 'POST',
        body: JSON.stringify({ patientId, clinicianId }),
      });
      return { success: true };
    } catch (err: any) {
      console.warn('⚡ [clinicianService] API assign clinician failed, trying direct Supabase fallback:', err.message);
    }
  }

  if (isSupabaseConfigured) {
    try {
      let targetUid = patientId;
      if (!isValidUuid(targetUid)) {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user?.id && isValidUuid(authData.user.id)) {
          targetUid = authData.user.id;
        }
      }

      if (!targetUid) {
        return { success: false, error: 'Invalid patient session ID for clinician assignment.' };
      }

      const { error: profileError } = await supabase
        .from('patient_profiles')
        .upsert(
          {
            user_id: targetUid,
            assigned_clinician_id: clinicianId,
            condition: 'Post-Stroke Motor Rehabilitation',
          },
          { onConflict: 'user_id' }
        );

      if (profileError) {
        console.error('❌ [clinicianService] Supabase patient_profiles upsert error:', profileError);
        return { success: false, error: profileError.message };
      }

      const { data: existingRx } = await supabase
        .from('prescriptions')
        .select('id')
        .eq('patient_id', targetUid)
        .limit(1);

      if (!existingRx || existingRx.length === 0) {
        const { error: rxError } = await supabase.from('prescriptions').insert({
          patient_id: targetUid,
          clinician_id: clinicianId,
          exercise_type: 'knee_extension',
          target_angle: 110,
          sets: 3,
          reps: 10,
          frequency_per_week: 5,
          notes: 'Focus on full terminal extension with a 2-second isometric pause. Keep back upright against chair.',
        });

        if (rxError) {
          console.warn('⚠️ [clinicianService] Prescription insert warning:', rxError.message);
        }
      }

      return { success: true };
    } catch (err: any) {
      console.error('❌ [clinicianService] Supabase assign clinician exception:', err);
      return { success: false, error: err.message || 'Failed to assign doctor in database.' };
    }
  }

  try {
    const patients = getMockPatients();
    const patientIndex = patients.findIndex((p) => p.id === patientId || p.id === 'p-001');

    const defaultClinicianMap: Record<string, any> = {
      'c-001': {
        id: 'c-001',
        name: 'Dr. Sarah Chen, PT, DPT',
        credentials: 'Board Certified Neurologic Specialist (NCS)',
        specialty: 'Post-Stroke Motor Neuro-Rehabilitation',
      },
    };

    const assignedClinician = defaultClinicianMap[clinicianId] || {
      id: clinicianId,
      name: 'Dr. Sarah Chen, PT, DPT',
      credentials: 'Board Certified Neurologic Specialist (NCS)',
      specialty: 'Post-Stroke Motor Neuro-Rehabilitation',
    };

    if (patientIndex !== -1) {
      patients[patientIndex].assignedClinician = assignedClinician;
      saveMockPatients(patients);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function fetchClinicianCaseload(clinicianId: string): Promise<MockPatientDetail[]> {
  if (API_BASE) {
    try {
      const data = await fetchApi(`/clinicians/${clinicianId}/caseload`);
      if (Array.isArray(data) && data.length > 0) {
        return data as MockPatientDetail[];
      }
    } catch (err) {
      console.warn('⚡ [clinicianService] API fetch caseload warning:', err);
    }
  }

  if (isSupabaseConfigured) {
    try {
      let { data: patData } = await supabase
        .from('patient_profiles')
        .select(`
          user_id,
          condition,
          condition_category,
          primary_injury,
          assigned_clinician_id,
          profile:profiles!user_id(id, full_name, email)
        `)
        .eq('assigned_clinician_id', clinicianId);

      // If no patients are explicitly assigned to this clinician ID, load all patient profiles
      if (!patData || patData.length === 0) {
        const { data: allPats } = await supabase
          .from('patient_profiles')
          .select(`
            user_id,
            condition,
            condition_category,
            primary_injury,
            assigned_clinician_id,
            profile:profiles!user_id(id, full_name, email)
          `)
          .limit(20);
        patData = allPats || [];
      }

      if (patData && patData.length > 0) {
        const caseload: MockPatientDetail[] = [];
        for (const pat of patData) {
          const pid = pat.user_id;
          if (!pid) continue;

          const profileObj = Array.isArray(pat.profile) ? pat.profile[0] : pat.profile || {};
          const patName = profileObj.full_name || 'Patient';
          const patEmail = profileObj.email || '';

          const stats = await fetchPatientDashboardStats(pid);

          caseload.push({
            id: pid,
            name: patName,
            email: patEmail,
            condition: pat.condition || stats.condition || 'Post-Stroke Motor Rehabilitation',
            conditionCategory: pat.condition_category || 'stroke',
            primaryInjury: pat.primary_injury || 'stroke_knee',
            recoveryStage: 'Active Rehabilitation',
            compliance: stats.weeklyAdherence || 85,
            assignedClinician: stats.assignedClinician || {
              id: clinicianId,
              name: 'Dr. Sarah Chen, PT, DPT',
              credentials: 'Board Certified Neurologic Specialist (NCS)',
              specialty: 'Post-Stroke Motor Neuro-Rehabilitation',
            },
            riskAlert: null,
            prescription: stats.prescription,
            romHistory: stats.romHistory || [],
            sessionsHistory: stats.sessionsHistory || [],
            angleDeviationData: [],
          });
        }
        if (caseload.length > 0) {
          return caseload;
        }
      }
    } catch (err) {
      console.warn('⚡ [clinicianService] Supabase fetch caseload error:', err);
    }
  }

  return getMockPatients();
}

export async function updateClinicianPrescription(
  patientId: string,
  clinicianId: string,
  prescriptionData: {
    exercise_type: ExerciseType;
    target_angle: number;
    sets: number;
    reps: number;
    frequency_per_week: number;
    notes?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  if (API_BASE) {
    try {
      await fetchApi('/clinicians/prescription', {
        method: 'POST',
        body: JSON.stringify({
          patientId,
          clinicianId,
          ...prescriptionData,
        }),
      });
      return { success: true };
    } catch (err: any) {
      console.warn('⚡ [clinicianService] API update prescription warning:', err.message);
    }
  }

  if (isSupabaseConfigured) {
    try {
      let targetUid = patientId;
      if (!isValidUuid(targetUid)) {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user?.id && isValidUuid(authData.user.id)) {
          targetUid = authData.user.id;
        }
      }

      const { error } = await supabase.from('prescriptions').insert({
        patient_id: targetUid,
        clinician_id: clinicianId,
        exercise_type: prescriptionData.exercise_type,
        target_angle: prescriptionData.target_angle,
        sets: prescriptionData.sets,
        reps: prescriptionData.reps,
        frequency_per_week: prescriptionData.frequency_per_week,
        notes: prescriptionData.notes || '',
      });

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      console.error('❌ [clinicianService] Supabase update prescription error:', err);
      return { success: false, error: err.message || 'Failed to update prescription' };
    }
  }

  try {
    updatePatientPrescription(patientId, prescriptionData);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
