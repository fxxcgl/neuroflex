import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("VITE_SUPABASE_ANON_KEY", "")

# In a real backend, you'd use the service role key for admin privileges
# SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

def get_supabase() -> Client:
    # We fallback to empty strings for safety, but it will raise errors if actually called without env vars
    return create_client(SUPABASE_URL, SUPABASE_KEY)
