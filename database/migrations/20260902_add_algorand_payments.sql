-- ==============================================================================
-- NeuroFlex - Algorand Pay-Per-Session Payment Gate & Movement Analysis Schema
-- ==============================================================================

-- 1. PENDING_PAYMENTS Table
CREATE TABLE IF NOT EXISTS public.pending_payments (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0.005,
  asset TEXT NOT NULL DEFAULT 'ALGO',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. USED_TRANSACTIONS Table
CREATE TABLE IF NOT EXISTS public.used_transactions (
  txn_id TEXT PRIMARY KEY,
  session_id UUID REFERENCES public.pending_payments(session_id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pending_payments_patient ON public.pending_payments(patient_id);
CREATE INDEX IF NOT EXISTS idx_pending_payments_status ON public.pending_payments(status);
CREATE INDEX IF NOT EXISTS idx_used_transactions_session ON public.used_transactions(session_id);

-- Enable RLS
ALTER TABLE public.pending_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.used_transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "pending_payments_select" ON public.pending_payments;
DROP POLICY IF EXISTS "pending_payments_insert" ON public.pending_payments;
DROP POLICY IF EXISTS "pending_payments_update" ON public.pending_payments;
DROP POLICY IF EXISTS "used_transactions_select" ON public.used_transactions;
DROP POLICY IF EXISTS "used_transactions_insert" ON public.used_transactions;

-- RLS Policies
CREATE POLICY "pending_payments_select"
  ON public.pending_payments
  FOR SELECT
  USING (patient_id = auth.uid() OR auth.uid() IS NOT NULL OR true);

CREATE POLICY "pending_payments_insert"
  ON public.pending_payments
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "pending_payments_update"
  ON public.pending_payments
  FOR UPDATE
  USING (true);

CREATE POLICY "used_transactions_select"
  ON public.used_transactions
  FOR SELECT
  USING (true);

CREATE POLICY "used_transactions_insert"
  ON public.used_transactions
  FOR INSERT
  WITH CHECK (true);
