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

  let requestUrl = endpoint;
  if (API_BASE) {
    const cleanBase = API_BASE.replace(/\/$/, '');
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    if (cleanBase.endsWith('/api')) {
      requestUrl = `${cleanBase}${cleanEndpoint.replace(/^\/api/, '')}`;
    } else if (cleanEndpoint.startsWith('/api')) {
      requestUrl = `${cleanBase}${cleanEndpoint}`;
    } else {
      requestUrl = `${cleanBase}/api${cleanEndpoint}`;
    }
  }

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
