import { createClient } from '@supabase/supabase-js';

const getEnv = (key: string): string => {
  const gProcess = (globalThis as any).process;
  if (gProcess?.env && gProcess.env[key]) {
    return gProcess.env[key];
  }
  try {
    return (import.meta as any).env?.[key] || '';
  } catch (e) {
    return '';
  }
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'https://your-project.supabase.co' &&
  supabaseAnonKey !== 'your-anon-key-here' &&
  supabaseUrl.startsWith('https://')
);

// Fallback client to prevent crashing before env variables are populated
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient('https://placeholder.supabase.co', 'placeholder-key', {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    });
