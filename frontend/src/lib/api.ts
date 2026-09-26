import { supabase } from './supabase';

const viteEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
export const API_BASE = (viteEnv?.VITE_API_BASE_URL || '').replace(/\/$/, '');

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const requestUrl = API_BASE ? `${API_BASE}${endpoint}` : endpoint;

  const response = await fetch(requestUrl, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `API Request failed: ${response.status}`);
  }

  return response.json();
}
