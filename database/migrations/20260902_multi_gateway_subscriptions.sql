-- ==============================================================================
-- NeuroFlex - Multi-Gateway Subscription System
-- ==============================================================================

-- 1. DOCTOR_PAYMENT_ACCOUNTS Table
CREATE TABLE IF NOT EXISTS public.doctor_payment_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID REFERENCES public.clinician_profiles(id) ON DELETE CASCADE,
  gateway TEXT NOT NULL CHECK (gateway IN ('razorpay', 'stripe', 'paypal')),
  connected_account_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_kyc' CHECK (status IN ('pending_kyc', 'active')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(doctor_id, gateway)
);

-- 2. SUBSCRIPTIONS Table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.patient_profiles(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES public.clinician_profiles(id) ON DELETE CASCADE,
  gateway TEXT NOT NULL CHECK (gateway IN ('razorpay', 'stripe', 'paypal')),
  gateway_subscription_id TEXT NOT NULL UNIQUE,
  amount NUMERIC NOT NULL,
  commission_percent NUMERIC NOT NULL DEFAULT 15.0,
  status TEXT NOT NULL DEFAULT 'incomplete' CHECK (status IN ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid')),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. SUBSCRIPTION_PAYMENTS Table
CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  gateway TEXT NOT NULL CHECK (gateway IN ('razorpay', 'stripe', 'paypal')),
  gateway_payment_id TEXT NOT NULL UNIQUE,
  gross_amount NUMERIC NOT NULL,
  platform_commission NUMERIC NOT NULL,
  doctor_payout_amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'succeeded' CHECK (status IN ('requires_payment_method', 'requires_confirmation', 'requires_action', 'processing', 'requires_capture', 'canceled', 'succeeded', 'failed')),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_doc_payments_doctor ON public.doctor_payment_accounts(doctor_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_patient ON public.subscriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_doctor ON public.subscriptions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_sub_payments_sub ON public.subscription_payments(subscription_id);

-- Enable RLS
ALTER TABLE public.doctor_payment_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "doc_payments_select" ON public.doctor_payment_accounts;
DROP POLICY IF EXISTS "doc_payments_insert" ON public.doctor_payment_accounts;
DROP POLICY IF EXISTS "doc_payments_update" ON public.doctor_payment_accounts;
DROP POLICY IF EXISTS "subscriptions_select" ON public.subscriptions;
DROP POLICY IF EXISTS "sub_payments_select" ON public.subscription_payments;

-- RLS Policies
-- Doctors can see their own payment accounts. Patients can see active payment accounts of all doctors (to know what gateways to show).
CREATE POLICY "doc_payments_select"
  ON public.doctor_payment_accounts
  FOR SELECT
  USING (
    doctor_id = auth.uid() OR
    status = 'active'
  );

-- Doctors can manage their own payment accounts
CREATE POLICY "doc_payments_insert"
  ON public.doctor_payment_accounts
  FOR INSERT
  WITH CHECK (doctor_id = auth.uid());

CREATE POLICY "doc_payments_update"
  ON public.doctor_payment_accounts
  FOR UPDATE
  USING (doctor_id = auth.uid());

-- Subscriptions can be seen by the patient who owns them, or the doctor who is assigned.
CREATE POLICY "subscriptions_select"
  ON public.subscriptions
  FOR SELECT
  USING (
    patient_id = auth.uid() OR
    doctor_id = auth.uid()
  );

-- Subscription payments can be seen by the patient or doctor involved.
CREATE POLICY "sub_payments_select"
  ON public.subscription_payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.id = subscription_payments.subscription_id
      AND (s.patient_id = auth.uid() OR s.doctor_id = auth.uid())
    )
  );

-- Note: Insert and Update on subscriptions and subscription_payments will be handled strictly by the secure backend webhook handlers via service role key bypass, not by RLS.

-- ==============================================================================
-- 2026-09-13 UPDATES: Auth Email Verification, Atomic Profile Trigger & Patient Caseload RLS
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
