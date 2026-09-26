-- ==============================================================================
-- NeuroFlex - Real-time Chat Subscription
-- ==============================================================================

BEGIN;

-- Enable Realtime for the messages table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END
$$;

COMMIT;
