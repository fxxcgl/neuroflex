-- ==============================================================================
-- NeuroFlex - Auth Trigger & Profiles Reliable Persistence Fix
-- Description:
-- 1. Adds email column to public.profiles if not exists.
-- 2. Creates/replaces handle_new_user() SECURITY DEFINER trigger to atomically
--    create profiles, patient_profiles (with assigned_clinician_id), and default
--    prescriptions on auth.users insert.
-- 3. Ensures RLS policies allow clinician and patient visibility.
-- ==============================================================================

-- 1. Ensure email column exists on public.profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'profiles' 
      AND column_name = 'email'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN email TEXT;
  END IF;
END $$;

-- 2. Enhanced Trigger Function for New User Registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role TEXT;
  user_name TEXT;
  raw_clinician_id TEXT;
  assigned_id UUID;
BEGIN
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'patient');
  user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  raw_clinician_id := NEW.raw_user_meta_data->>'assigned_clinician_id';

  -- 1. Insert/Update public.profiles
  INSERT INTO public.profiles (id, email, role, full_name, created_at)
  VALUES (NEW.id, NEW.email, user_role, user_name, timezone('utc'::text, now()))
  ON CONFLICT (id) DO UPDATE
  SET
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    role = COALESCE(EXCLUDED.role, public.profiles.role),
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);

  -- 2. Insert into respective role profile table
  IF user_role = 'patient' THEN
    -- Safely parse UUID if assigned_clinician_id was provided
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

    -- 3. If clinician assigned, initialize default prescription
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

-- 3. Drop and recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Verify RLS Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinician_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_reps ENABLE ROW LEVEL SECURITY;

-- Ensure profiles SELECT allows authenticated users to see their own profile,
-- any clinician profiles, and clinicians can see their assigned patients.
DROP POLICY IF EXISTS "profiles_select_clinicians" ON public.profiles;
CREATE POLICY "profiles_select_clinicians"
  ON public.profiles
  FOR SELECT
  USING (role = 'clinician' OR id = auth.uid());

DROP POLICY IF EXISTS "profiles_select_clinician_assigned_patients" ON public.profiles;
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

-- Ensure patient_profiles allows patient and assigned clinician
DROP POLICY IF EXISTS "patient_profiles_select_patient" ON public.patient_profiles;
CREATE POLICY "patient_profiles_select_patient"
  ON public.patient_profiles
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "patient_profiles_select_assigned_clinician" ON public.patient_profiles;
CREATE POLICY "patient_profiles_select_assigned_clinician"
  ON public.patient_profiles
  FOR SELECT
  USING (assigned_clinician_id = auth.uid());

DROP POLICY IF EXISTS "patient_profiles_insert_patient" ON public.patient_profiles;
CREATE POLICY "patient_profiles_insert_patient"
  ON public.patient_profiles
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "patient_profiles_update_patient" ON public.patient_profiles;
CREATE POLICY "patient_profiles_update_patient"
  ON public.patient_profiles
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Ensure sessions allows assigned clinician
DROP POLICY IF EXISTS "sessions_select_assigned_clinician" ON public.sessions;
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

-- Ensure session_reps allows assigned clinician
DROP POLICY IF EXISTS "session_reps_select_assigned_clinician" ON public.session_reps;
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
