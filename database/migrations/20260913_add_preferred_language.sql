-- Add preferred_language column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT 'en';

-- Add a comment to the column for documentation
COMMENT ON COLUMN public.profiles.preferred_language IS 'User''s preferred language for the UI (en, hi, ta, te, ml, bn, kn, mr, as)';
