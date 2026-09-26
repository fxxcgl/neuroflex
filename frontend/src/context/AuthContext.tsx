import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { AuthContextType, UserProfile, UserRole } from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_STORAGE_KEY = 'neuroflex_demo_user';
const DEMO_ACCOUNTS_KEY = 'neuroflex_demo_accounts';
const PENDING_SIGNUP_ROLE_KEY = 'neuroflex_pending_signup_role';

function asUserRole(value: unknown): UserRole | undefined {
  return value === 'clinician' || value === 'patient' ? value : undefined;
}

function readMetadataRole(userLike: { user_metadata?: Record<string, unknown> } | null | undefined): UserRole | undefined {
  const meta = userLike?.user_metadata;
  if (!meta) return undefined;
  return asUserRole(meta.user_role) || asUserRole(meta.role);
}

export function setPendingSignupRole(role: UserRole, email?: string) {
  try {
    const payload = JSON.stringify({
      role,
      email: (email || '').trim().toLowerCase(),
    });
    sessionStorage.setItem(PENDING_SIGNUP_ROLE_KEY, payload);
    localStorage.setItem(PENDING_SIGNUP_ROLE_KEY, payload);
  } catch {}
}

function readPendingSignupPayload(): { role: UserRole; email: string } | undefined {
  try {
    const raw = sessionStorage.getItem(PENDING_SIGNUP_ROLE_KEY)
      || localStorage.getItem(PENDING_SIGNUP_ROLE_KEY);
    if (!raw) return undefined;
    if (raw === 'clinician' || raw === 'patient') {
      return { role: raw, email: '' };
    }
    const parsed = JSON.parse(raw);
    const role = asUserRole(parsed?.role);
    if (!role) return undefined;
    return { role, email: String(parsed.email || '').trim().toLowerCase() };
  } catch {
    return undefined;
  }
}

export function getPendingSignupRole(email?: string): UserRole | undefined {
  const pending = readPendingSignupPayload();
  if (!pending) return undefined;
  const needle = (email || '').trim().toLowerCase();
  if (pending.email && needle && pending.email !== needle) return undefined;
  return pending.role;
}

export function clearPendingSignupRole() {
  try {
    sessionStorage.removeItem(PENDING_SIGNUP_ROLE_KEY);
    localStorage.removeItem(PENDING_SIGNUP_ROLE_KEY);
  } catch {}
}

export interface StoredDemoAccount {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  assigned_clinician_id?: string;
  email_confirmed_at: string | null;
  created_at: string;
}

export function getStoredDemoAccounts(): StoredDemoAccount[] {
  try {
    const raw = localStorage.getItem(DEMO_ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredDemoAccount(account: StoredDemoAccount) {
  try {
    const list = getStoredDemoAccounts().filter(a => a.email.toLowerCase() !== account.email.toLowerCase());
    list.push(account);
    localStorage.setItem(DEMO_ACCOUNTS_KEY, JSON.stringify(list));
  } catch {}
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(!isSupabaseConfigured);

  const ensureRoleSideTable = async (userId: string, role: UserRole) => {
    if (role === 'clinician') {
      await supabase.from('clinician_profiles').upsert({
        user_id: userId,
        credentials: 'Board Certified Neurologic Specialist (NCS)',
        specialty: 'Post-Stroke Motor Neuro-Rehabilitation',
      });
    }
  };

  // Fetch or create profile from Supabase. Intended role comes from Auth metadata /
  // clinician signup storage — never silently default a clinician signup to patient.
  const fetchProfile = async (userId: string, userEmail: string, fallbackRole?: UserRole) => {
    if (!isSupabaseConfigured) return;

    const intendedRole = getPendingSignupRole(userEmail) || asUserRole(fallbackRole);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!error && data) {
        const existing = data as UserProfile;
        // The DB trigger defaults missing metadata to "patient". If this session
        // registered as a clinician, correct that — never downgrade a clinician.
        const shouldPromoteToClinician =
          existing.role !== 'clinician' && intendedRole === 'clinician';

        if (shouldPromoteToClinician) {
          const { data: updated, error: updateError } = await supabase
            .from('profiles')
            .update({ role: 'clinician' })
            .eq('id', userId)
            .select()
            .single();

          if (!updateError && updated) {
            await ensureRoleSideTable(userId, 'clinician');
            clearPendingSignupRole();
            setProfile(updated as UserProfile);
            return;
          }
        }

        if (intendedRole && existing.role === intendedRole) {
          await ensureRoleSideTable(userId, intendedRole);
          clearPendingSignupRole();
        }
        setProfile(existing);
        return;
      }

      const newRole = intendedRole || 'patient';
      const { data: upserted, error: upsertError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: userId,
            email: userEmail,
            role: newRole,
            full_name: userEmail.split('@')[0],
          },
          { onConflict: 'id' }
        )
        .select()
        .single();

      if (!upsertError && upserted) {
        await ensureRoleSideTable(userId, newRole);
        if (intendedRole) clearPendingSignupRole();
        setProfile(upserted as UserProfile);
        return;
      }

      const { data: retry } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (retry) {
        setProfile(retry as UserProfile);
        return;
      }

      setProfile({
        id: userId,
        email: userEmail,
        role: newRole,
        full_name: userEmail.split('@')[0],
      });
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  };

  useEffect(() => {
    let isMounted = true;

    if (isSupabaseConfigured) {
      // Check active Supabase session (use getUser to hit the server for latest email_confirmed_at)
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!isMounted) return;
        if (user) {
          setUser(user);
          const pending = getPendingSignupRole(user.email || '');
          const metaRole = readMetadataRole(user);
          fetchProfile(user.id, user.email || '', pending || metaRole).finally(() => {
            if (isMounted) setLoading(false);
          });
        } else {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      });

      // Listen to Supabase auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (!isMounted) return;
        if (session?.user) {
          setUser(session.user);
          const pending = getPendingSignupRole(session.user.email || '');
          const metaRole = readMetadataRole(session.user);
          if (pending === 'clinician' && metaRole !== 'clinician') {
            await supabase.auth.updateUser({
              data: { user_role: 'clinician', role: 'clinician' },
            });
          }
          await fetchProfile(session.user.id, session.user.email || '', pending || metaRole);
        } else {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      });

      return () => {
        isMounted = false;
        subscription.unsubscribe();
      };
    } else {
      // Check demo user in localStorage
      const savedDemo = localStorage.getItem(DEMO_STORAGE_KEY);
      if (savedDemo) {
        try {
          const parsed = JSON.parse(savedDemo);
          setUser({ id: parsed.id, email: parsed.email, email_confirmed_at: parsed.email_confirmed_at || null });
          if (parsed.email_confirmed_at) {
            setProfile(parsed);
          } else {
            setProfile(null);
          }
        } catch (e) {
          localStorage.removeItem(DEMO_STORAGE_KEY);
        }
      }
      setLoading(false);
      setIsDemoMode(true);
    }
  }, []);

  const switchDemoUser = (role: UserRole) => {
    const now = new Date().toISOString();
    const demoProfile: UserProfile = {
      id: `demo-${role}-${Date.now()}`,
      email: role === 'patient' ? 'robert.patient@example.com' : 'dr.sarah.clinician@example.com',
      role: role,
      full_name: role === 'patient' ? 'Robert Miller' : 'Dr. Sarah Chen, PT',
      phone: role === 'patient' ? '+1 (555) 234-5678' : '+1 (555) 876-5432',
      created_at: now,
    };
    setUser({ id: demoProfile.id, email: demoProfile.email, email_confirmed_at: now });
    setProfile(demoProfile);
    setIsDemoMode(true);
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ ...demoProfile, email_confirmed_at: now }));
  };

  const confirmDemoVerification = async (targetEmail?: string): Promise<boolean> => {
    const emailToConfirm = (targetEmail || user?.email || '').trim().toLowerCase();
    if (!emailToConfirm) return false;

    const now = new Date().toISOString();
    const accounts = getStoredDemoAccounts();
    const existing = accounts.find(a => a.email.toLowerCase() === emailToConfirm);

    if (existing) {
      existing.email_confirmed_at = now;
      saveStoredDemoAccount(existing);

      const confProfile: UserProfile = {
        id: existing.id,
        email: existing.email,
        role: existing.role,
        full_name: existing.full_name,
        created_at: existing.created_at,
      };
      setUser({ id: existing.id, email: existing.email, email_confirmed_at: now });
      setProfile(confProfile);
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ ...existing, email_confirmed_at: now }));
      console.log('✅ [AuthContext Demo] Successfully confirmed demo email:', emailToConfirm);
      return true;
    } else if (user) {
      const confUser = { ...user, email_confirmed_at: now };
      setUser(confUser);
      const confProfile: UserProfile = {
        id: user.id,
        email: user.email,
        role: (user.id.includes('clinician') ? 'clinician' : 'patient') as UserRole,
        full_name: user.email?.split('@')[0] || 'User',
        created_at: now,
      };
      setProfile(confProfile);
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ ...confProfile, email_confirmed_at: now }));
      return true;
    }
    return false;
  };

  const signIn = async (email: string, password: string, fallbackRole?: UserRole) => {
    if (!isSupabaseConfigured) {
      const cleanEmail = email.trim().toLowerCase();
      const accounts = getStoredDemoAccounts();
      const existing = accounts.find(a => a.email.toLowerCase() === cleanEmail);

      if (existing) {
        if (!existing.email_confirmed_at) {
          console.warn('⚠️ [AuthContext Demo] Sign in blocked - email not confirmed:', cleanEmail);
          setUser({ id: existing.id, email: existing.email, email_confirmed_at: null });
          setProfile(null);
          return { error: 'Email not confirmed', needsEmailVerification: true };
        }

        const confirmedProfile: UserProfile = {
          id: existing.id,
          email: existing.email,
          role: existing.role,
          full_name: existing.full_name,
          created_at: existing.created_at,
        };
        setUser({ id: existing.id, email: existing.email, email_confirmed_at: existing.email_confirmed_at });
        setProfile(confirmedProfile);
        localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(existing));
        return { error: null };
      }

      // If no account exists in demo storage, fail the login
      return { error: 'Invalid login credentials' };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        const isEmailNotConfirmed = error.message.toLowerCase().includes('email not confirmed');
        return { 
          error: error.message, 
          needsEmailVerification: isEmailNotConfirmed 
        };
      }

      if (data.user) {
        setUser(data.user);

        // Check if email confirmation is required but unverified
        if (!data.user.email_confirmed_at && isSupabaseConfigured) {
          console.warn('⚠️ [AuthContext] User email is not verified yet:', data.user.email);
          return { error: null, needsEmailVerification: true };
        }

        const metaRole = getPendingSignupRole(data.user.email || email) || readMetadataRole(data.user);
        await fetchProfile(data.user.id, data.user.email || email, metaRole);
      }

      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'An unexpected error occurred.' };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    role: UserRole,
    fullName?: string,
    assignedClinicianId?: string
  ) => {
    if (!isSupabaseConfigured) {
      // In demo mode: create new account in unconfirmed state to guarantee verification requirement
      const demoId = `demo-${role}-${Date.now()}`;
      const newAccount: StoredDemoAccount = {
        id: demoId,
        email: email.trim(),
        role,
        full_name: fullName?.trim() || email.split('@')[0].replace(/[._]/g, ' '),
        assigned_clinician_id: assignedClinicianId || 'c-001',
        email_confirmed_at: null, // REQUIREMENT: Unconfirmed until verified!
        created_at: new Date().toISOString(),
      };

      saveStoredDemoAccount(newAccount);

      // Set user as unconfirmed, profile null
      setUser({ id: demoId, email: email.trim(), email_confirmed_at: null });
      setProfile(null);
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(newAccount));

      console.log('⚡ [AuthContext Demo] Registered unconfirmed demo user:', newAccount);
      return { error: null, needsEmailVerification: true };
    }


    try {
      console.log('⚡ [AuthContext] Signing up user with metadata:', {
        email,
        role,
        fullName,
        assignedClinicianId,
      });

      setPendingSignupRole(role, email);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            // user_role avoids colliding with the reserved JWT "role" claim.
            user_role: role,
            role,
            full_name: fullName || email.split('@')[0],
            assigned_clinician_id: assignedClinicianId || null,
          },
          emailRedirectTo: `${window.location.origin}/login`,
        }
      });

      if (error) {
        console.error('❌ [AuthContext] Supabase auth.signUp error:', error);
        return { error: error.message };
      }

      if (data.user) {
        console.log('✅ [AuthContext] Supabase auth user registered successfully:', data.user.id);
        
        // Check if confirmation email was sent
        const needsVerification = isSupabaseConfigured && !data.user.email_confirmed_at;

        // Dual-layer safety: explicitly attempt client upserts with detailed error logging
        // (Note: Postgres trigger handle_new_user also handles this with SECURITY DEFINER)
        try {
          // 1. Explicitly upsert profile
          const { error: profileErr } = await supabase.from('profiles').upsert({
            id: data.user.id,
            email: data.user.email || email,
            role: role,
            full_name: fullName || email.split('@')[0],
          }, { onConflict: 'id' });

          if (profileErr) {
            console.warn('⚠️ [AuthContext] Client-side profile upsert note (handled by Postgres trigger if unauthenticated):', profileErr.message);
          } else {
            console.log('✅ [AuthContext] Profile row confirmed via client upsert.');
          }

          if (data.session) {
            await supabase.auth.updateUser({
              data: {
                user_role: role,
                role,
                full_name: fullName || email.split('@')[0],
              },
            });
          }

          // 2. If patient, explicitly upsert patient_profiles with assigned_clinician_id
          if (role === 'patient') {
            const { error: patientErr } = await supabase.from('patient_profiles').upsert({
              user_id: data.user.id,
              assigned_clinician_id: assignedClinicianId || null,
              condition: 'Post-Stroke Motor Rehabilitation',
            });

            if (patientErr) {
              console.warn('⚠️ [AuthContext] Client-side patient_profiles upsert note:', patientErr.message);
            }

            // 3. If clinician assigned, initialize default prescription
            if (assignedClinicianId && assignedClinicianId !== 'c-001') {
              const { error: rxErr } = await supabase.from('prescriptions').insert([
                {
                  patient_id: data.user.id,
                  clinician_id: assignedClinicianId,
                  exercise_type: 'knee_extension',
                  target_angle: 110,
                  sets: 3,
                  reps: 10,
                  frequency_per_week: 5,
                  notes: 'Focus on full terminal extension with a 2-second isometric pause.',
                },
              ]);

              if (rxErr) {
                console.warn('⚠️ [AuthContext] Client-side prescription insert note:', rxErr.message);
              }
            }
          } else if (role === 'clinician') {
            const { error: clinicianErr } = await supabase.from('clinician_profiles').upsert({
              user_id: data.user.id,
              credentials: 'Board Certified Neurologic Specialist (NCS)',
              specialty: 'Post-Stroke Motor Neuro-Rehabilitation',
            });

            if (clinicianErr) {
              console.warn('⚠️ [AuthContext] Client-side clinician_profiles upsert note:', clinicianErr.message);
            }
          }
        } catch (clientInsertError) {
          console.error('❌ [AuthContext] Unexpected error during client-side profile creation:', clientInsertError);
        }

        if (needsVerification) {
          // Keep user object for verification reference, but don't set active profile until confirmed
          setUser(data.user);
          return { error: null, needsEmailVerification: true };
        }

        // If session was immediately active (email confirmation off)
        setUser(data.user);
        await fetchProfile(data.user.id, data.user.email || email, role);
      }

      return { error: null };
    } catch (err: any) {
      console.error('❌ [AuthContext] Uncaught error in signUp:', err);
      return { error: err.message || 'Failed to sign up.' };
    }
  };

  const signOut = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem(DEMO_STORAGE_KEY);
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isDemoMode,
        isSupabaseConfigured,
        signIn,
        signUp,
        signOut,
        switchDemoUser,
        confirmDemoVerification,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
