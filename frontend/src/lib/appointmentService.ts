import { fetchApi, API_BASE } from './api';
import { supabase, isSupabaseConfigured } from './supabase';
import type { Appointment, AppointmentStatus } from '../types';

export const initialMockAppointments: Appointment[] = [];

export async function fetchAppointments(userId: string, role: 'patient' | 'clinician'): Promise<Appointment[]> {
  if (API_BASE) {
    try {
      const data = await fetchApi(`/appointments?userId=${userId}&role=${role}`);
      if (Array.isArray(data)) return data as Appointment[];
    } catch (e) {
      console.warn('⚡ [appointmentService] API fetch appointments warning:', e);
    }
  }

  if (isSupabaseConfigured) {
    try {
      const field = role === 'patient' ? 'patient_id' : 'clinician_id';
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq(field, userId)
        .order('scheduled_at', { ascending: true });

      if (!error && data) {
        return data.map((a: any) => ({
          id: a.id,
          patientId: a.patient_id,
          clinicianId: a.clinician_id,
          scheduledAt: a.scheduled_at,
          status: a.status,
          notes: a.notes,
          createdAt: a.created_at,
        }));
      }
    } catch (err) {
      console.warn('⚡ [appointmentService] Supabase fetch appointments error:', err);
    }
  }

  return [];
}

export async function requestAppointment(
  patientId: string,
  clinicianId: string,
  scheduledAt: string
): Promise<Appointment> {
  if (API_BASE) {
    try {
      const data = await fetchApi('/appointments', {
        method: 'POST',
        body: JSON.stringify({ patientId, clinicianId, scheduledAt }),
      });
      return data as Appointment;
    } catch (e) {
      console.warn('⚡ [appointmentService] API request appointment warning:', e);
    }
  }

  if (isSupabaseConfigured) {
    try {
      const newApt = {
        patient_id: patientId,
        clinician_id: clinicianId,
        scheduled_at: scheduledAt,
        status: 'pending' as const,
      };
      const { data, error } = await supabase
        .from('appointments')
        .insert([newApt])
        .select()
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id,
          patientId: data.patient_id,
          clinicianId: data.clinician_id,
          scheduledAt: data.scheduled_at,
          status: data.status,
          notes: data.notes,
          createdAt: data.created_at,
        };
      }
    } catch (err) {
      console.warn('⚡ [appointmentService] Supabase appointment insert error:', err);
    }
  }

  return {
    id: `apt-${Date.now()}`,
    patientId,
    clinicianId,
    scheduledAt,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
}

export async function updateAppointmentStatus(
  appointmentId: string,
  status: AppointmentStatus
): Promise<boolean> {
  if (API_BASE) {
    try {
      await fetchApi(`/appointments/${appointmentId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      return true;
    } catch (e) {
      console.warn('⚡ [appointmentService] API update appointment warning:', e);
    }
  }

  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', appointmentId);
      return !error;
    } catch (err) {
      console.warn('⚡ [appointmentService] Supabase update appointment status error:', err);
    }
  }

  return true;
}
