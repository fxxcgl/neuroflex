-- Ensure clinician signups are not stored as patients.
-- GoTrue may omit custom "role" (JWT reserved claim) from raw_user_meta_data
-- at INSERT time; also read user_role and never downgrade clinician -> patient.

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
