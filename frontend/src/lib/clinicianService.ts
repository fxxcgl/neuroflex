import { fetchApi } from './api';
import type { MockPatientDetail } from './mockData';
import type { ExerciseType } from '../types';

export interface ClinicianOption {
  id: string;
  name: string;
  credentials: string;
  specialty: string;
  email?: string;
}

export async function fetchAvailableClinicians(): Promise<ClinicianOption[]> {
  try {
    const data = await fetchApi('/clinicians');
    return data as ClinicianOption[];
  } catch (err) {
    console.error('API fetch clinicians error:', err);
    return [];
  }
}

export async function assignClinicianToPatient(
  patientId: string,
  clinicianId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await fetchApi('/clinicians/assign', {
      method: 'POST',
      body: JSON.stringify({ patientId, clinicianId }),
    });
    return { success: true };
  } catch (err: any) {
    console.error('API assign clinician error:', err);
    return { success: false, error: err.message };
  }
}

export async function fetchClinicianCaseload(clinicianId: string): Promise<MockPatientDetail[]> {
  try {
    const data = await fetchApi(`/clinicians/${clinicianId}/caseload`);
    return data as MockPatientDetail[];
  } catch (err) {
    console.error('API fetch caseload error:', err);
    return [];
  }
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
  try {
    await fetchApi('/clinicians/prescription', {
      method: 'POST',
      body: JSON.stringify({
        patientId,
        clinicianId,
        ...prescriptionData
      }),
    });
    return { success: true };
  } catch (err: any) {
    console.error('API update prescription error:', err);
    return { success: false, error: err.message };
  }
}
