-- Migration: 20260916_expand_exercises.sql
-- Description: Expand prescriptions.exercise_type to support 14 exercise types,
--              and add Mode B/C telemetry columns to session_reps.

-- 1. Drop old exercise_type check constraint on prescriptions
ALTER TABLE public.prescriptions
  DROP CONSTRAINT IF EXISTS prescriptions_exercise_type_check;

-- Add new CHECK constraint with all 14 exercise types
ALTER TABLE public.prescriptions
  ADD CONSTRAINT prescriptions_exercise_type_check
  CHECK (exercise_type IN (
    'knee_extension',
    'shoulder_raise',
    'straight_leg_raise',
    'heel_slides',
    'mini_squats',
    'sit_to_stand',
    'calf_raises',
    'ankle_pumps',
    'ankle_circles',
    'balance_hold',
    'gait_training',
    'quad_sets',
    'resistance_band',
    'muscle_activation'
  ));

-- 2. Add Mode B/C columns to session_reps (all nullable)
ALTER TABLE public.session_reps
  ADD COLUMN IF NOT EXISTS hold_duration_seconds NUMERIC,
  ADD COLUMN IF NOT EXISTS stability_score NUMERIC,
  ADD COLUMN IF NOT EXISTS rotation_count INTEGER;

ALTER TABLE public.session_reps
  ADD COLUMN IF NOT EXISTS self_reported BOOLEAN NOT NULL DEFAULT false;

-- 3. Make angle columns nullable so Mode B/C records don't carry dummy angle data
ALTER TABLE public.session_reps
  ALTER COLUMN peak_angle DROP NOT NULL,
  ALTER COLUMN min_angle  DROP NOT NULL,
  ALTER COLUMN rom_range  DROP NOT NULL;
