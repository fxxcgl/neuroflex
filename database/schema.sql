-- ==============================================================================
-- NeuroFlex - Complete Supabase Postgres DDL & Row Level Security (RLS) Migration
-- 
-- Run this in your Supabase SQL Editor: https://app.supabase.com/project/_/sql
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. PROFILES Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('patient', 'clinician')),
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 2. PATIENT_PROFILES Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patient_profiles (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  date_of_birth DATE,
  condition TEXT,
  condition_category TEXT CHECK (condition_category IN ('stroke', 'orthopedic', 'sports_injury', 'post_surgery')),
  primary_injury TEXT CHECK (primary_injury IN (
    'stroke_knee',
    'stroke_shoulder',
    'ortho_knee_pain',
    'ortho_ankle_injury',
    'sports_ankle_twist',
    'sports_leg_raise',
    'post_surgery_knee'
  )),
  assigned_clinician_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Backfill/compatibility for existing projects created before onboarding columns were added.
ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS condition_category TEXT CHECK (condition_category IN ('stroke', 'orthopedic', 'sports_injury', 'post_surgery'));
ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS primary_injury TEXT CHECK (primary_injury IN (
    'stroke_knee',
    'stroke_shoulder',
    'ortho_knee_pain',
    'ortho_ankle_injury',
    'sports_ankle_twist',
    'sports_leg_raise',
    'post_surgery_knee'
  ));

-- ------------------------------------------------------------------------------
-- 3. CLINICIAN_PROFILES Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clinician_profiles (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  credentials TEXT,
  specialty TEXT
);

-- ------------------------------------------------------------------------------
-- 4. PRESCRIPTIONS Table
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 5. SESSIONS Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  prescription_id UUID REFERENCES public.prescriptions(id) ON DELETE SET NULL,
  exercise_type TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  ended_at TIMESTAMPTZ
);

-- ------------------------------------------------------------------------------
-- 6. SESSION_REPS Table
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 7. MESSAGES Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id TEXT NOT NULL,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 8. APPOINTMENTS Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  clinician_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')) DEFAULT 'pending'
);

-- ==============================================================================
-- INDEXES FOR FAST QUERYING
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_patient_profiles_clinician ON public.patient_profiles(assigned_clinician_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON public.prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_clinician ON public.prescriptions(clinician_id);
CREATE INDEX IF NOT EXISTS idx_sessions_patient ON public.sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_session_reps_session ON public.session_reps(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON public.messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_recipient ON public.messages(sender_id, recipient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON public.appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_clinician ON public.appointments(clinician_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) ACTIVATION
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinician_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_reps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to allow safe re-execution
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname, tablename 
    FROM pg_policies 
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- RLS POLICIES: 1. PROFILES
-- ------------------------------------------------------------------------------
-- Users can view their own profile and all clinician profiles (for onboarding selection)
CREATE POLICY "profiles_select_clinicians"
  ON public.profiles
  FOR SELECT
  USING (role = 'clinician' OR id = auth.uid());

-- Clinicians can view profiles of their assigned patients
CREATE POLICY "profiles_select_clinician_assigned_patients"
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.patient_profiles pp
      WHERE pp.user_id = public.profiles.id
        AND pp.assigned_clinician_id = auth.uid()
    )
  );

-- Users can insert and update their own profile
CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  USING (id = auth.uid());

-- ------------------------------------------------------------------------------
-- RLS POLICIES: 2. PATIENT_PROFILES
-- ------------------------------------------------------------------------------
-- Patients can view/manage their own patient profile
CREATE POLICY "patient_profiles_select_patient"
  ON public.patient_profiles
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "patient_profiles_insert_patient"
  ON public.patient_profiles
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "patient_profiles_update_patient"
  ON public.patient_profiles
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Assigned clinician can view and update their assigned patients
CREATE POLICY "patient_profiles_select_assigned_clinician"
  ON public.patient_profiles
  FOR SELECT
  USING (assigned_clinician_id = auth.uid());

CREATE POLICY "patient_profiles_update_assigned_clinician"
  ON public.patient_profiles
  FOR UPDATE
  USING (assigned_clinician_id = auth.uid());

-- ------------------------------------------------------------------------------
-- RLS POLICIES: 3. CLINICIAN_PROFILES
-- ------------------------------------------------------------------------------
-- All users can view clinician credentials/specialty for doctor selection
CREATE POLICY "clinician_profiles_select_all"
  ON public.clinician_profiles
  FOR SELECT
  USING (true);

CREATE POLICY "clinician_profiles_insert_clinician"
  ON public.clinician_profiles
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "clinician_profiles_update_clinician"
  ON public.clinician_profiles
  FOR UPDATE
  USING (user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- RLS POLICIES: 4. PRESCRIPTIONS
-- ------------------------------------------------------------------------------
-- Patients can read their own prescriptions
CREATE POLICY "prescriptions_select_patient"
  ON public.prescriptions
  FOR SELECT
  USING (patient_id = auth.uid());

-- Clinicians can select, insert, update, and delete prescriptions for their assigned patients
CREATE POLICY "prescriptions_select_assigned_clinician"
  ON public.prescriptions
  FOR SELECT
  USING (
    clinician_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.patient_profiles pp
      WHERE pp.user_id = public.prescriptions.patient_id
        AND pp.assigned_clinician_id = auth.uid()
    )
  );

CREATE POLICY "prescriptions_insert_assigned_clinician"
  ON public.prescriptions
  FOR INSERT
  WITH CHECK (
    clinician_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.patient_profiles pp
      WHERE pp.user_id = public.prescriptions.patient_id
        AND pp.assigned_clinician_id = auth.uid()
    )
  );

CREATE POLICY "prescriptions_update_assigned_clinician"
  ON public.prescriptions
  FOR UPDATE
  USING (
    clinician_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.patient_profiles pp
      WHERE pp.user_id = public.prescriptions.patient_id
        AND pp.assigned_clinician_id = auth.uid()
    )
  );

CREATE POLICY "prescriptions_delete_assigned_clinician"
  ON public.prescriptions
  FOR DELETE
  USING (
    clinician_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.patient_profiles pp
      WHERE pp.user_id = public.prescriptions.patient_id
        AND pp.assigned_clinician_id = auth.uid()
    )
  );

-- ------------------------------------------------------------------------------
-- RLS POLICIES: 5. SESSIONS
-- ------------------------------------------------------------------------------
-- Patients can read, create, and update their own rehab sessions
CREATE POLICY "sessions_select_patient"
  ON public.sessions
  FOR SELECT
  USING (patient_id = auth.uid());

CREATE POLICY "sessions_insert_patient"
  ON public.sessions
  FOR INSERT
  WITH CHECK (patient_id = auth.uid());

CREATE POLICY "sessions_update_patient"
  ON public.sessions
  FOR UPDATE
  USING (patient_id = auth.uid());

-- Assigned clinicians can view sessions of their assigned patients
CREATE POLICY "sessions_select_assigned_clinician"
  ON public.sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.patient_profiles pp
      WHERE pp.user_id = public.sessions.patient_id
        AND pp.assigned_clinician_id = auth.uid()
    )
  );

-- ------------------------------------------------------------------------------
-- RLS POLICIES: 6. SESSION_REPS
-- ------------------------------------------------------------------------------
-- Patients can read and insert rep telemetry for their own sessions
CREATE POLICY "session_reps_select_patient"
  ON public.session_reps
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = public.session_reps.session_id
        AND s.patient_id = auth.uid()
    )
  );

CREATE POLICY "session_reps_insert_patient"
  ON public.session_reps
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = public.session_reps.session_id
        AND s.patient_id = auth.uid()
    )
  );

-- Assigned clinicians can view session reps of their assigned patients
CREATE POLICY "session_reps_select_assigned_clinician"
  ON public.session_reps
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      JOIN public.patient_profiles pp ON pp.user_id = s.patient_id
      WHERE s.id = public.session_reps.session_id
        AND pp.assigned_clinician_id = auth.uid()
    )
  );

-- ------------------------------------------------------------------------------
-- RLS POLICIES: 7. MESSAGES
-- ------------------------------------------------------------------------------
-- Users can read messages where they are sender or recipient
CREATE POLICY "messages_select"
  ON public.messages
  FOR SELECT
  USING (
    sender_id = auth.uid() OR recipient_id = auth.uid()
  );

-- Users can send messages where they are sender
CREATE POLICY "messages_insert"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
  );

-- ------------------------------------------------------------------------------
-- RLS POLICIES: 8. APPOINTMENTS
-- ------------------------------------------------------------------------------
-- Patients can view their appointments
CREATE POLICY "appointments_select_patient"
  ON public.appointments
  FOR SELECT
  USING (patient_id = auth.uid());

-- Clinicians can view appointments for their assigned patients
CREATE POLICY "appointments_select_assigned_clinician"
  ON public.appointments
  FOR SELECT
  USING (
    clinician_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.patient_profiles pp
      WHERE pp.user_id = public.appointments.patient_id
        AND pp.assigned_clinician_id = auth.uid()
    )
  );

-- Patients and assigned clinicians can book appointments
CREATE POLICY "appointments_insert"
  ON public.appointments
  FOR INSERT
  WITH CHECK (
    (patient_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.patient_profiles pp
      WHERE pp.user_id = auth.uid() AND pp.assigned_clinician_id = public.appointments.clinician_id
    ))
    OR
    (clinician_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.patient_profiles pp
      WHERE pp.user_id = public.appointments.patient_id AND pp.assigned_clinician_id = auth.uid()
    ))
  );

-- Either party can update appointment status (e.g. confirm, complete, cancel)
CREATE POLICY "appointments_update"
  ON public.appointments
  FOR UPDATE
  USING (
    (patient_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.patient_profiles pp
      WHERE pp.user_id = auth.uid() AND pp.assigned_clinician_id = public.appointments.clinician_id
    ))
    OR
    (clinician_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.patient_profiles pp
      WHERE pp.user_id = public.appointments.patient_id AND pp.assigned_clinician_id = auth.uid()
    ))
  );

-- ==============================================================================
-- AUTOMATIC TRIGGER FOR USER REGISTRATION (auth.users -> public.profiles & role table)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role TEXT;
  user_name TEXT;
  raw_clinician_id TEXT;
  assigned_id UUID;
BEGIN
  user_role := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'user_role', ''),
    NULLIF(NEW.raw_user_meta_data->>'role', ''),
    'patient'
  );
  IF user_role NOT IN ('patient', 'clinician') THEN
    user_role := 'patient';
  END IF;
  user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  raw_clinician_id := NEW.raw_user_meta_data->>'assigned_clinician_id';

  -- 1. Insert into public.profiles
  INSERT INTO public.profiles (id, email, role, full_name, created_at)
  VALUES (NEW.id, NEW.email, user_role, user_name, timezone('utc'::text, now()))
  ON CONFLICT (id) DO UPDATE
  SET
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    role = CASE
      WHEN EXCLUDED.role = 'clinician' OR public.profiles.role = 'clinician' THEN 'clinician'
      ELSE COALESCE(EXCLUDED.role, public.profiles.role)
    END,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);

  -- 2. Insert into respective profile table
  IF user_role = 'patient' THEN
    assigned_id := NULL;
    IF raw_clinician_id IS NOT NULL AND raw_clinician_id <> '' AND raw_clinician_id <> 'c-001' THEN
      BEGIN
        assigned_id := raw_clinician_id::UUID;
      EXCEPTION WHEN OTHERS THEN
        assigned_id := NULL;
      END;
    END IF;

    INSERT INTO public.patient_profiles (user_id, assigned_clinician_id, condition)
    VALUES (NEW.id, assigned_id, 'Post-Stroke Motor Rehabilitation')
    ON CONFLICT (user_id) DO UPDATE
    SET
      assigned_clinician_id = COALESCE(EXCLUDED.assigned_clinician_id, public.patient_profiles.assigned_clinician_id);

    IF assigned_id IS NOT NULL THEN
      INSERT INTO public.prescriptions (
        patient_id,
        clinician_id,
        exercise_type,
        target_angle,
        sets,
        reps,
        frequency_per_week,
        notes
      ) VALUES (
        NEW.id,
        assigned_id,
        'knee_extension',
        110,
        3,
        10,
        5,
        'Focus on full terminal extension with a 2-second isometric pause.'
      ) ON CONFLICT DO NOTHING;
    END IF;

  ELSIF user_role = 'clinician' THEN
    INSERT INTO public.clinician_profiles (user_id, credentials, specialty)
    VALUES (
      NEW.id,
      'Board Certified Neurologic Specialist (NCS)',
      'Post-Stroke Motor Neuro-Rehabilitation'
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 9. PENDING_PAYMENTS Table (Algorand Pay-Per-Session)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pending_payments (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0.005,
  asset TEXT NOT NULL DEFAULT 'ALGO',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 10. USED_TRANSACTIONS Table (Anti-Replay / Double-Spend Protection)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.used_transactions (
  txn_id TEXT PRIMARY KEY,
  session_id UUID REFERENCES public.pending_payments(session_id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_pending_payments_patient ON public.pending_payments(patient_id);
CREATE INDEX IF NOT EXISTS idx_pending_payments_status ON public.pending_payments(status);
CREATE INDEX IF NOT EXISTS idx_used_transactions_session ON public.used_transactions(session_id);

ALTER TABLE public.pending_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.used_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pending_payments_all" ON public.pending_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "used_transactions_all" ON public.used_transactions FOR ALL USING (true) WITH CHECK (true);
