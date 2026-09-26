import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { fetchAvailableClinicians, type ClinicianOption } from '../lib/clinicianService';
import type { UserRole } from '../types';
import { 
  UserCheck, 
  Stethoscope, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  CheckCircle2, 
  User, 
  ArrowRight,
  Sparkles,
  Loader2
} from 'lucide-react';

interface AuthPageProps {
  initialMode?: 'login' | 'signup';
}

export const AuthPage: React.FC<AuthPageProps> = ({ initialMode = 'login' }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile, signIn, signUp, switchDemoUser, isSupabaseConfigured } = useAuth();
  const { t } = useTranslation();

  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  
  // Read role from query param or default to 'patient'
  const paramRole = searchParams.get('role') as UserRole;
  const [role, setRole] = useState<UserRole>(paramRole === 'clinician' ? 'clinician' : 'patient');
  
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Email verification pending state
  const [signupVerificationPending, setSignupVerificationPending] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendStatusMsg, setResendStatusMsg] = useState<{ success: boolean; text: string } | null>(null);

  // Clinician list for patient onboarding
  const [clinicians, setClinicians] = useState<ClinicianOption[]>([]);
  const [selectedClinicianId, setSelectedClinicianId] = useState<string>('');

  useEffect(() => {
    fetchAvailableClinicians().then((list) => {
      setClinicians(list);
      if (list.length > 0) {
        setSelectedClinicianId(list[0].id);
      }
    });
  }, []);

  // If already logged in, automatically redirect to appropriate dashboard (only if verified)
  useEffect(() => {
    if (user && !user.email_confirmed_at) {
      navigate('/verify-email', { state: { email: user.email }, replace: true });
      return;
    }
    if (user && profile) {
      if (profile.role === 'clinician') {
        navigate('/clinician/dashboard', { replace: true });
      } else {
        navigate('/patient/dashboard', { replace: true });
      }
    }
  }, [user, profile, navigate]);

  useEffect(() => {
    if (paramRole === 'clinician' || paramRole === 'patient') {
      setRole(paramRole);
    }
  }, [paramRole]);

  const handleResendSignupEmail = async () => {
    if (!registeredEmail) return;
    setResendingEmail(true);
    setResendStatusMsg(null);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: registeredEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });
      if (error) {
        setResendStatusMsg({ success: false, text: error.message || 'Failed to resend email.' });
      } else {
        setResendStatusMsg({ success: true, text: 'Verification link resent! Please check your inbox and spam folder.' });
      }
    } catch (e: any) {
      setResendStatusMsg({ success: false, text: e.message || 'Network error occurred.' });
    } finally {
      setResendingEmail(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Basic validation
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both your email and password.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    if (mode === 'signup') {
      const assignedId = role === 'patient' ? (selectedClinicianId || (clinicians[0]?.id)) : undefined;
      const res = await signUp(email.trim(), password, role, fullName.trim() || undefined, assignedId);
      
      if (res.error) {
        setErrorMsg(res.error);
        setLoading(false);
      } else if (res.needsEmailVerification || isSupabaseConfigured) {
        // Requirement 1: Show a clear "Check your email to verify your account" screen instead of immediately logging the user in
        setRegisteredEmail(email.trim());
        setSignupVerificationPending(true);
        setLoading(false);
      } else {
        setSuccessMsg('Demo account registered! Redirecting to setup...');
        setTimeout(() => {
          navigate(role === 'clinician' ? '/clinician/dashboard' : '/patient/onboarding');
        }, 600);
      }
    } else {
      // Login
      const res = await signIn(email.trim(), password, role);
      if (res.needsEmailVerification) {
        navigate('/verify-email', { state: { email: email.trim() } });
      } else if (res.error) {
        setErrorMsg(res.error);
        setLoading(false);
      } else {
        setSuccessMsg('Logged in successfully! Redirecting...');
        setTimeout(() => {
          navigate(role === 'clinician' ? '/clinician/dashboard' : '/patient/dashboard');
        }, 600);
      }
    }
  };

  const handleQuickDemo = (demoRole: UserRole) => {
    switchDemoUser(demoRole);
    navigate(demoRole === 'clinician' ? '/clinician/dashboard' : '/patient/dashboard');
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-lg bg-white rounded-3xl border-2 border-slate-200 shadow-xl overflow-hidden">
        
        {/* Verification Pending Screen (Requirement 1) */}
        {signupVerificationPending ? (
          <div className="animate-in fade-in zoom-in-95 duration-200">
            <div className="p-8 bg-gradient-to-r from-teal-800 to-slate-900 text-white text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mb-4 text-teal-300 shadow-inner">
                <Mail className="w-8 h-8" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Check Your Email</h1>
              <p className="text-sm text-teal-100 font-medium mt-1.5 max-w-sm">
                Verify your email address to activate your rehabilitation portal.
              </p>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 text-center">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Verification email sent to
                </span>
                <span className="text-base font-black text-slate-900 break-all">
                  {registeredEmail}
                </span>
              </div>

              <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
                <p className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                  <span>We’ve dispatched a confirmation link to your inbox. Click the link to verify your account.</span>
                </p>
                <p className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                  <span>Once confirmed, you will be able to sign in and begin your guided exercise sessions.</span>
                </p>
              </div>

              {resendStatusMsg && (
                <div
                  className={`p-4 rounded-2xl text-sm font-semibold flex items-start gap-3 ${
                    resendStatusMsg.success
                      ? 'bg-emerald-50 border-2 border-emerald-300 text-emerald-900'
                      : 'bg-rose-50 border-2 border-rose-300 text-rose-900'
                  }`}
                  role="alert"
                >
                  {resendStatusMsg.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <span>{resendStatusMsg.text}</span>
                </div>
              )}

              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSignupVerificationPending(false);
                    setMode('login');
                    setErrorMsg(null);
                  }}
                  className="w-full py-3.5 px-6 rounded-2xl bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-black text-base shadow-lg shadow-teal-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Proceed to Sign In</span>
                  <ArrowRight className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={handleResendSignupEmail}
                  disabled={resendingEmail}
                  className="w-full py-3.5 px-6 rounded-2xl border-2 border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {resendingEmail ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
                      <span>Resending Verification Link...</span>
                    </>
                  ) : (
                    <span>Resend Verification Email</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
        
        {/* Header Tabs */}
        <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-50 text-center">
          <button
            type="button"
            onClick={() => { setMode('login'); setErrorMsg(null); }}
            className={`min-h-[56px] text-base font-extrabold transition-all flex items-center justify-center gap-2 ${
              mode === 'login'
                ? 'bg-white text-slate-900 border-b-4 border-teal-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {t('auth.login_title', 'Sign In')}
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setErrorMsg(null); }}
            className={`min-h-[56px] text-base font-extrabold transition-all flex items-center justify-center gap-2 ${
              mode === 'signup'
                ? 'bg-white text-slate-900 border-b-4 border-teal-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {t('auth.signup_title', 'Create Account')}
          </button>
        </div>

        <div className="p-6 sm:p-8">

          {/* Role Selector Header */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-slate-700 mb-2">
              {mode === 'signup' ? '1. Select Your Role (Required):' : 'Select Portal Type:'}
            </label>
            <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Select User Role">
              <button
                type="button"
                onClick={() => setRole('patient')}
                role="radio"
                aria-checked={role === 'patient'}
                className={`min-h-[54px] p-3 rounded-2xl border-2 text-left flex items-center gap-3 transition-all ${
                  role === 'patient'
                    ? 'border-sky-600 bg-sky-50 text-sky-950 font-bold ring-2 ring-sky-300'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 font-semibold'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  role === 'patient' ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-extrabold leading-tight">Patient</div>
                  <div className="text-xs text-slate-500">Stroke Recovery</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRole('clinician')}
                role="radio"
                aria-checked={role === 'clinician'}
                className={`min-h-[54px] p-3 rounded-2xl border-2 text-left flex items-center gap-3 transition-all ${
                  role === 'clinician'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold ring-2 ring-emerald-300'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 font-semibold'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  role === 'clinician' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  <Stethoscope className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-extrabold leading-tight">Clinician</div>
                  <div className="text-xs text-slate-500">Therapist / PT</div>
                </div>
              </button>
            </div>
          </div>

          {/* Feedback Messages */}
          {errorMsg && (
            <div 
              className="mb-6 p-4 rounded-2xl bg-red-50 border-2 border-red-300 text-red-800 flex items-start gap-3 text-sm font-semibold"
              role="alert"
            >
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p>{errorMsg}</p>
                {errorMsg.toLowerCase().includes('email not confirmed') && (
                  <button
                    type="button"
                    onClick={() => navigate('/verify-email', { state: { email: email.trim() } })}
                    className="mt-2 text-xs font-black text-red-700 underline hover:text-red-900 block cursor-pointer"
                  >
                    Click here to verify your email address →
                  </button>
                )}
              </div>
            </div>
          )}

          {successMsg && (
            <div 
              className="mb-6 p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-900 flex items-start gap-3 text-sm font-semibold"
              role="status"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>{successMsg}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Full Name for Signup */}
            {mode === 'signup' && (
              <div>
                <label 
                  htmlFor="full_name" 
                  className="block text-sm font-bold text-slate-800 mb-1.5"
                >
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <User className="w-5 h-5" />
                  </div>
                  <input
                    id="full_name"
                    name="full_name"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={role === 'clinician' ? 'e.g. Dr. Sarah Chen, PT' : 'e.g. Robert Miller'}
                    className="w-full min-h-[52px] pl-12 pr-4 bg-slate-50 border-2 border-slate-300 rounded-2xl text-slate-900 text-base font-medium focus:bg-white focus:border-teal-600 focus:outline-none transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>
            )}

            {/* Clinician Selection for Patient Signup */}
            {mode === 'signup' && role === 'patient' && (
              <div>
                <label 
                  htmlFor="assigned_clinician" 
                  className="block text-sm font-bold text-slate-800 mb-1.5 flex items-center gap-1.5"
                >
                  <Stethoscope className="w-4 h-4 text-emerald-700" />
                  <span>Assign Physical Therapist / Doctor</span>
                </label>
                <div className="relative">
                  <select
                    id="assigned_clinician"
                    value={selectedClinicianId}
                    onChange={(e) => setSelectedClinicianId(e.target.value)}
                    className="w-full min-h-[52px] px-4 bg-emerald-50/70 border-2 border-emerald-300 rounded-2xl text-slate-900 text-sm font-bold focus:bg-white focus:border-emerald-600 focus:outline-none transition-all cursor-pointer"
                  >
                    {clinicians.length === 0 ? (
                      <option value="c-001">Dr. Sarah Chen, PT, DPT (Neurologic Specialist)</option>
                    ) : (
                      clinicians.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} — {c.credentials} ({c.specialty})
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Your chosen therapist will monitor your ROM telemetry, prescribe exercises, and communicate via secure chat.
                </p>
              </div>
            )}

            {/* Email Address */}
            <div>
              <label htmlFor="email" className="block text-sm font-bold text-slate-700 mb-1.5 ml-1">
                {t('auth.email', 'Email Address')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.name@example.com"
                  className="w-full min-h-[52px] pl-12 pr-4 bg-slate-50 border-2 border-slate-300 rounded-2xl text-slate-900 text-base font-medium focus:bg-white focus:border-teal-600 focus:outline-none transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-sm font-bold text-slate-700 mb-1.5 ml-1">
                  {t('auth.password', 'Password')}
                </label>
                <span className="text-xs text-slate-700 font-medium">Min 6 characters</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full min-h-[52px] pl-12 pr-12 bg-slate-50 border-2 border-slate-300 rounded-2xl text-slate-900 text-base font-medium focus:bg-white focus:border-teal-600 focus:outline-none transition-all placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-slate-800 touch-target focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className={`w-full min-h-[56px] rounded-2xl text-white text-lg font-extrabold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer ${
                  role === 'clinician'
                    ? 'bg-emerald-700 hover:bg-emerald-800 focus:ring-4 focus:ring-emerald-300'
                    : 'bg-sky-600 hover:bg-sky-700 focus:ring-4 focus:ring-sky-300'
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>{t('auth.submit', 'Please wait...')}</span>
                  </>
                ) : (
                  <>
                    <span>{mode === 'signup' ? t('auth.signup_title', 'Create Account') : t('auth.login_title', 'Sign In')}</span>
                    <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                  </>
                )}
              </button>
            </div>

          </form>

          {/* Quick Demo Section for Fast Evaluation */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <div className="text-center mb-3">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-teal-600" /> Instant 1-Click Demo Logins
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleQuickDemo('patient')}
                className="touch-target px-3 py-2.5 rounded-xl border border-sky-300 bg-sky-50/80 hover:bg-sky-100 text-sky-900 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <UserCheck className="w-4 h-4 text-sky-600" /> Demo Patient
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemo('clinician')}
                className="touch-target px-3 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-900 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Stethoscope className="w-4 h-4 text-emerald-700" /> Demo Clinician
              </button>
            </div>
          </div>

        </div>
        </>
      )}

      </div>
    </div>
  );
};
