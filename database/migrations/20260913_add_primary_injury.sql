-- Migration: Add primary_injury and condition_category to patient_profiles

DO $$
BEGIN
  -- Add condition_category column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'patient_profiles' AND column_name = 'condition_category'
  ) THEN
    ALTER TABLE patient_profiles ADD COLUMN condition_category TEXT;
  END IF;

  -- Add primary_injury column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'patient_profiles' AND column_name = 'primary_injury'
  ) THEN
    ALTER TABLE patient_profiles ADD COLUMN primary_injury TEXT;
  END IF;
END $$;

-- Check constraint on primary_injury
ALTER TABLE patient_profiles DROP CONSTRAINT IF EXISTS check_primary_injury;
ALTER TABLE patient_profiles ADD CONSTRAINT check_primary_injury CHECK (
  primary_injury IS NULL OR primary_injury IN (
    'stroke_knee',
    'stroke_shoulder',
    'ortho_knee_pain',
    'ortho_ankle_injury',
    'sports_ankle_twist',
    'sports_leg_raise',
    'post_surgery_knee'
  )
);

-- Check constraint on condition_category
ALTER TABLE patient_profiles DROP CONSTRAINT IF EXISTS check_condition_category;
ALTER TABLE patient_profiles ADD CONSTRAINT check_condition_category CHECK (
  condition_category IS NULL OR condition_category IN (
    'stroke',
    'orthopedic',
    'sports_injury',
    'post_surgery'
  )
);
