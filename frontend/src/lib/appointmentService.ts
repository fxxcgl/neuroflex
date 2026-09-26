import { fetchApi } from './api';
import type { Appointment, AppointmentStatus } from '../types';

export const initialMockAppointments: Appointment[] = [];

export async function fetchAppointments(userId: string, role: 'patient' | 'clinician'): Promise<Appointment[]> {
  try {
    const data = await fetchApi(`/appointments?userId=${userId}&role=${role}`);
    return data as Appointment[];
  } catch (e) {
    console.warn('API fetch appointments error:', e);
    return [];
  }
}

export async function requestAppointment(
  patientId: string,
  clinicianId: string,
  scheduledAt: string
): Promise<Appointment> {
  try {
    const data = await fetchApi('/appointments', {
      method: 'POST',
      body: JSON.stringify({ patientId, clinicianId, scheduledAt }),
    });
    return data as Appointment;
  } catch (e) {
    console.warn('API request appointment error:', e);
    throw e;
  }
}

export async function updateAppointmentStatus(
  appointmentId: string,
  status: AppointmentStatus
): Promise<boolean> {
  try {
    await fetchApi(`/appointments/${appointmentId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    return true;
  } catch (e) {
    console.warn('API update appointment error:', e);
    return false;
  }
}
