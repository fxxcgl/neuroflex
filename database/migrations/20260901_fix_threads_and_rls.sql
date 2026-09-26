-- ==============================================================================
-- NeuroFlex - Clinician Caseload, Threads & Comprehensive RLS Policies Fix
-- Run this in your Supabase SQL Editor: https://app.supabase.com/project/_/sql
-- ==============================================================================

-- 1. Ensure thread_id in messages is TEXT (allows deterministic thread_userA_userB keys)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'messages' 
      AND column_name = 'thread_id'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.messages ALTER COLUMN thread_id TYPE TEXT USING thread_id::text;
  END IF;
END $$;

-- 2. Drop existing policies to safely recreate
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_clinicians" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_clinician_assigned_patients" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_patient_assigned_clinician" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

DROP POLICY IF EXISTS "patient_profiles_select_patient" ON public.patient_profiles;
DROP POLICY IF EXISTS "patient_profiles_insert_patient" ON public.patient_profiles;
DROP POLICY IF EXISTS "patient_profiles_update_patient" ON public.patient_profiles;
DROP POLICY IF EXISTS "patient_profiles_select_assigned_clinician" ON public.patient_profiles;
DROP POLICY IF EXISTS "patient_profiles_update_assigned_clinician" ON public.patient_profiles;

DROP POLICY IF EXISTS "clinician_profiles_select_all" ON public.clinician_profiles;
DROP POLICY IF EXISTS "clinician_profiles_select_clinician" ON public.clinician_profiles;
DROP POLICY IF EXISTS "clinician_profiles_insert_clinician" ON public.clinician_profiles;
DROP POLICY IF EXISTS "clinician_profiles_update_clinician" ON public.clinician_profiles;

DROP POLICY IF EXISTS "sessions_select_patient" ON public.sessions;
DROP POLICY IF EXISTS "sessions_insert_patient" ON public.sessions;
DROP POLICY IF EXISTS "sessions_update_patient" ON public.sessions;
DROP POLICY IF EXISTS "sessions_select_assigned_clinician" ON public.sessions;

DROP POLICY IF EXISTS "session_reps_select_patient" ON public.session_reps;
DROP POLICY IF EXISTS "session_reps_insert_patient" ON public.session_reps;
DROP POLICY IF EXISTS "session_reps_select_assigned_clinician" ON public.session_reps;

DROP POLICY IF EXISTS "prescriptions_select_patient" ON public.prescriptions;
DROP POLICY IF EXISTS "prescriptions_select_assigned_clinician" ON public.prescriptions;
DROP POLICY IF EXISTS "prescriptions_insert_assigned_clinician" ON public.prescriptions;
DROP POLICY IF EXISTS "prescriptions_update_assigned_clinician" ON public.prescriptions;
DROP POLICY IF EXISTS "prescriptions_delete_assigned_clinician" ON public.prescriptions;

DROP POLICY IF EXISTS "messages_select" ON public.messages;
DROP POLICY IF EXISTS "messages_insert" ON public.messages;

-- 3. Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinician_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_reps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 4. PROFILES RLS Policies
-- All clinicians can be seen by patients for onboarding/assigning dropdowns
CREATE POLICY "profiles_select_clinicians"
  ON public.profiles
  FOR SELECT
  USING (role = 'clinician' OR id = auth.uid());

-- Clinicians can see profiles of their assigned patients
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

CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  USING (id = auth.uid());

-- 5. CLINICIAN_PROFILES RLS Policies
-- Allow all authenticated users to view clinician details for selection
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

-- 6. PATIENT_PROFILES RLS Policies
CREATE POLICY "patient_profiles_select_patient"
  ON public.patient_profiles
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "patient_profiles_insert_patient"
  ON public.patient_profiles
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Patients can update their own profile (e.g. choose or change assigned_clinician_id)
CREATE POLICY "patient_profiles_update_patient"
  ON public.patient_profiles
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Clinicians can SELECT and UPDATE patient_profiles where assigned_clinician_id matches their own id
CREATE POLICY "patient_profiles_select_assigned_clinician"
  ON public.patient_profiles
  FOR SELECT
  USING (assigned_clinician_id = auth.uid());

CREATE POLICY "patient_profiles_update_assigned_clinician"
  ON public.patient_profiles
  FOR UPDATE
  USING (assigned_clinician_id = auth.uid());

-- 7. PRESCRIPTIONS RLS Policies
CREATE POLICY "prescriptions_select_patient"
  ON public.prescriptions
  FOR SELECT
  USING (patient_id = auth.uid());

CREATE POLICY "prescriptions_select_assigned_clinician"
  ON public.prescriptions
  FOR SELECT
  USING (
    clinician_id = auth.uid() OR
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
    clinician_id = auth.uid() OR patient_id = auth.uid()
  );

CREATE POLICY "prescriptions_update_assigned_clinician"
  ON public.prescriptions
  FOR UPDATE
  USING (
    clinician_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.patient_profiles pp
      WHERE pp.user_id = public.prescriptions.patient_id
        AND pp.assigned_clinician_id = auth.uid()
    )
  );

-- 8. SESSIONS RLS Policies
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

-- 9. SESSION_REPS RLS Policies
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

-- 10. MESSAGES RLS Policies
CREATE POLICY "messages_select"
  ON public.messages
  FOR SELECT
  USING (
    sender_id = auth.uid() OR recipient_id = auth.uid()
  );

CREATE POLICY "messages_insert"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
  );
