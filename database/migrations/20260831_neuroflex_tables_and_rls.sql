-- Migration: 20260831_neuroflex_tables_and_rls.sql
-- Description: Creates profiles, patient_profiles, clinician_profiles, prescriptions,
-- sessions, session_reps, messages, appointments with comprehensive RLS policies.

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('patient', 'clinician')),
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. patient_profiles
CREATE TABLE IF NOT EXISTS public.patient_profiles (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  date_of_birth DATE,
  condition TEXT,
  assigned_clinician_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- 3. clinician_profiles
CREATE TABLE IF NOT EXISTS public.clinician_profiles (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  credentials TEXT,
  specialty TEXT
);

-- 4. prescriptions
CREATE TABLE IF NOT EXISTS public.prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  clinician_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  exercise_type TEXT NOT NULL CHECK (exercise_type IN ('knee_extension', 'shoulder_raise')),
  target_angle NUMERIC NOT NULL,
  sets INTEGER NOT NULL DEFAULT 3,
  reps INTEGER NOT NULL DEFAULT 10,
  frequency_per_week INTEGER NOT NULL DEFAULT 5,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. sessions
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  prescription_id UUID REFERENCES public.prescriptions(id) ON DELETE SET NULL,
  exercise_type TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  ended_at TIMESTAMPTZ
);

-- 6. session_reps
CREATE TABLE IF NOT EXISTS public.session_reps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  rep_number INTEGER NOT NULL,
  peak_angle NUMERIC NOT NULL,
  min_angle NUMERIC NOT NULL,
  rom_range NUMERIC NOT NULL,
  target_met BOOLEAN NOT NULL DEFAULT false,
  compensation_flags TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. messages
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. appointments
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  clinician_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')) DEFAULT 'pending'
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinician_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_reps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Policies
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_select_clinician_assigned_patients" ON public.profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.patient_profiles pp WHERE pp.user_id = public.profiles.id AND pp.assigned_clinician_id = auth.uid())
);
CREATE POLICY "profiles_select_patient_assigned_clinician" ON public.profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.patient_profiles pp WHERE pp.user_id = auth.uid() AND pp.assigned_clinician_id = public.profiles.id)
);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (id = auth.uid());

-- 2. Patient Profiles Policies
CREATE POLICY "patient_profiles_select_patient" ON public.patient_profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "patient_profiles_insert_patient" ON public.patient_profiles FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "patient_profiles_update_patient" ON public.patient_profiles FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "patient_profiles_select_assigned_clinician" ON public.patient_profiles FOR SELECT USING (assigned_clinician_id = auth.uid());
CREATE POLICY "patient_profiles_update_assigned_clinician" ON public.patient_profiles FOR UPDATE USING (assigned_clinician_id = auth.uid());

-- 3. Clinician Profiles Policies
CREATE POLICY "clinician_profiles_select_clinician" ON public.clinician_profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "clinician_profiles_insert_clinician" ON public.clinician_profiles FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "clinician_profiles_update_clinician" ON public.clinician_profiles FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "clinician_profiles_select_assigned_patient" ON public.clinician_profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.patient_profiles pp WHERE pp.user_id = auth.uid() AND pp.assigned_clinician_id = public.clinician_profiles.user_id)
);

-- 4. Prescriptions Policies
CREATE POLICY "prescriptions_select_patient" ON public.prescriptions FOR SELECT USING (patient_id = auth.uid());
CREATE POLICY "prescriptions_select_assigned_clinician" ON public.prescriptions FOR SELECT USING (
  clinician_id = auth.uid() AND EXISTS (SELECT 1 FROM public.patient_profiles pp WHERE pp.user_id = public.prescriptions.patient_id AND pp.assigned_clinician_id = auth.uid())
);
CREATE POLICY "prescriptions_insert_assigned_clinician" ON public.prescriptions FOR INSERT WITH CHECK (
  clinician_id = auth.uid() AND EXISTS (SELECT 1 FROM public.patient_profiles pp WHERE pp.user_id = public.prescriptions.patient_id AND pp.assigned_clinician_id = auth.uid())
);
CREATE POLICY "prescriptions_update_assigned_clinician" ON public.prescriptions FOR UPDATE USING (
  clinician_id = auth.uid() AND EXISTS (SELECT 1 FROM public.patient_profiles pp WHERE pp.user_id = public.prescriptions.patient_id AND pp.assigned_clinician_id = auth.uid())
);
CREATE POLICY "prescriptions_delete_assigned_clinician" ON public.prescriptions FOR DELETE USING (
  clinician_id = auth.uid() AND EXISTS (SELECT 1 FROM public.patient_profiles pp WHERE pp.user_id = public.prescriptions.patient_id AND pp.assigned_clinician_id = auth.uid())
);

-- 5. Sessions Policies
CREATE POLICY "sessions_select_patient" ON public.sessions FOR SELECT USING (patient_id = auth.uid());
CREATE POLICY "sessions_insert_patient" ON public.sessions FOR INSERT WITH CHECK (patient_id = auth.uid());
CREATE POLICY "sessions_update_patient" ON public.sessions FOR UPDATE USING (patient_id = auth.uid());
CREATE POLICY "sessions_select_assigned_clinician" ON public.sessions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.patient_profiles pp WHERE pp.user_id = public.sessions.patient_id AND pp.assigned_clinician_id = auth.uid())
);

-- 6. Session Reps Policies
CREATE POLICY "session_reps_select_patient" ON public.session_reps FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = public.session_reps.session_id AND s.patient_id = auth.uid())
);
CREATE POLICY "session_reps_insert_patient" ON public.session_reps FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = public.session_reps.session_id AND s.patient_id = auth.uid())
);
CREATE POLICY "session_reps_select_assigned_clinician" ON public.session_reps FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.sessions s JOIN public.patient_profiles pp ON pp.user_id = s.patient_id WHERE s.id = public.session_reps.session_id AND pp.assigned_clinician_id = auth.uid())
);

-- 7. Messages Policies
CREATE POLICY "messages_select" ON public.messages FOR SELECT USING (sender_id = auth.uid() OR recipient_id = auth.uid());
CREATE POLICY "messages_insert" ON public.messages FOR INSERT WITH CHECK (
  sender_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.patient_profiles pp 
    WHERE (pp.user_id = auth.uid() AND pp.assigned_clinician_id = public.messages.recipient_id)
       OR (pp.user_id = public.messages.recipient_id AND pp.assigned_clinician_id = auth.uid())
  )
);

-- 8. Appointments Policies
CREATE POLICY "appointments_select_patient" ON public.appointments FOR SELECT USING (patient_id = auth.uid());
CREATE POLICY "appointments_select_assigned_clinician" ON public.appointments FOR SELECT USING (
  clinician_id = auth.uid() AND EXISTS (SELECT 1 FROM public.patient_profiles pp WHERE pp.user_id = public.appointments.patient_id AND pp.assigned_clinician_id = auth.uid())
);
CREATE POLICY "appointments_insert" ON public.appointments FOR INSERT WITH CHECK (
  (patient_id = auth.uid() AND EXISTS (SELECT 1 FROM public.patient_profiles pp WHERE pp.user_id = auth.uid() AND pp.assigned_clinician_id = public.appointments.clinician_id))
  OR
  (clinician_id = auth.uid() AND EXISTS (SELECT 1 FROM public.patient_profiles pp WHERE pp.user_id = public.appointments.patient_id AND pp.assigned_clinician_id = auth.uid()))
);
CREATE POLICY "appointments_update" ON public.appointments FOR UPDATE USING (
  (patient_id = auth.uid() AND EXISTS (SELECT 1 FROM public.patient_profiles pp WHERE pp.user_id = auth.uid() AND pp.assigned_clinician_id = public.appointments.clinician_id))
  OR
  (clinician_id = auth.uid() AND EXISTS (SELECT 1 FROM public.patient_profiles pp WHERE pp.user_id = public.appointments.patient_id AND pp.assigned_clinician_id = auth.uid()))
);

-- Trigger for auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role TEXT;
  user_name TEXT;
BEGIN
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'patient');
  user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));

  INSERT INTO public.profiles (id, role, full_name, created_at)
  VALUES (NEW.id, user_role, user_name, timezone('utc'::text, now()))
  ON CONFLICT (id) DO UPDATE
  SET role = EXCLUDED.role, full_name = EXCLUDED.full_name;

  IF user_role = 'patient' THEN
    INSERT INTO public.patient_profiles (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  ELSIF user_role = 'clinician' THEN
    INSERT INTO public.clinician_profiles (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
