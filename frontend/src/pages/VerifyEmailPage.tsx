import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, CheckCircle2, RefreshCw, LogOut, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const VerifyEmailPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, signOut, confirmDemoVerification } = useAuth();

  const [resending, setResending] = useState<boolean>(false);
  const [resendStatus, setResendStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [checking, setChecking] = useState<boolean>(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState<number>(0);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Email can come from logged-in user, location state, or localStorage
  const email = user?.email || (location.state as any)?.email || '';

  const handleResend = async () => {
    if (!email) {
      setResendStatus({ success: false, message: 'No email address found to resend verification to.' });
      return;
    }

    setResending(true);
    setResendStatus(null);
    setCheckError(null);

    if (!isSupabaseConfigured) {
      // Demo simulation
      setTimeout(() => {
        setResendStatus({
          success: true,
          message: `Demo Mode: Verification link refreshed for ${email}. Click "I've Confirmed My Email" below to proceed.`,
        });
        setResending(false);
      }, 500);
      return;
    }

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (error) {
        setResendStatus({ success: false, message: error.message || 'Failed to resend verification email.' });
      } else {
        setResendStatus({
          success: true,
          message: 'Verification link resent successfully! Please check your inbox and spam folders.',
        });
        setCooldown(60);
      }
    } catch (err: any) {
      setResendStatus({ success: false, message: err.message || 'Network error occurred.' });
    } finally {
      setResending(false);
    }
  };

  const handleCheckVerification = async () => {
    setChecking(true);
    setCheckError(null);

    if (!isSupabaseConfigured) {
      // Demo simulation verification
      if (confirmDemoVerification) {
        const success = await confirmDemoVerification(email);
        if (success) {
          const role = profile?.role || (email.includes('clinician') ? 'clinician' : 'patient');
          navigate(role === 'clinician' ? '/clinician/dashboard' : '/patient/onboarding', { replace: true });
          return;
        }
      }
      setCheckError('Could not confirm verification in demo mode.');
      setChecking(false);
      return;
    }

    try {
      // Refresh current user data from Supabase Auth
      const { data: { user: refreshedUser }, error } = await supabase.auth.getUser();

      if (error || !refreshedUser) {
        setCheckError('Could not verify status. Please ensure you have clicked the confirmation link in your email.');
        setChecking(false);
        return;
      }

      if (refreshedUser.email_confirmed_at) {
        // User is verified!
        const role = profile?.role
          || (refreshedUser.user_metadata?.user_role as string)
          || (refreshedUser.user_metadata?.role as string)
          || 'patient';
        navigate(role === 'clinician' ? '/clinician/dashboard' : '/patient/onboarding', { replace: true });
      } else {
        setCheckError('Your email is not verified yet. Please click the link sent to your inbox, or request a new one below.');
      }
    } catch (err: any) {
      setCheckError(err.message || 'Error checking verification status.');
    } finally {
      setChecking(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-slate-50">
      <div className="w-full max-w-lg bg-white rounded-3xl border-2 border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Header Banner */}
        <div className="p-8 bg-gradient-to-r from-teal-800 to-slate-900 text-white text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mb-4 text-teal-300 shadow-inner">
            <Mail className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Verify Your Email</h1>
          <p className="text-sm text-teal-100 font-medium mt-1.5 max-w-sm">
            Please confirm your email address to access your secure rehabilitation dashboard.
          </p>
        </div>

        {/* Card Body */}
        <div className="p-6 sm:p-8 space-y-6">
          
          {email && (
            <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 text-center">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Verification sent to
              </span>
              <span className="text-base font-black text-slate-900 break-all">
                {email}
              </span>
            </div>
          )}

          <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
            <p className="flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
              <span>We’ve dispatched an email containing a secure verification link to your inbox.</span>
            </p>
            <p className="flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
              <span>Click the link in that email to activate your account and access telemetry & doctor tracking.</span>
            </p>
          </div>

          {/* Status Feedback Messages */}
          {resendStatus && (
            <div
              className={`p-4 rounded-2xl text-sm font-semibold flex items-start gap-3 ${
                resendStatus.success
                  ? 'bg-emerald-50 border-2 border-emerald-300 text-emerald-900'
                  : 'bg-rose-50 border-2 border-rose-300 text-rose-900'
              }`}
              role="alert"
            >
              {resendStatus.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span>{resendStatus.message}</span>
            </div>
          )}

          {checkError && (
            <div
              className="p-4 rounded-2xl text-sm font-semibold bg-amber-50 border-2 border-amber-300 text-amber-950 flex items-start gap-3"
              role="alert"
            >
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <span>{checkError}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            <button
              onClick={handleCheckVerification}
              disabled={checking}
              className="w-full py-3.5 px-6 rounded-2xl bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-black text-base shadow-lg shadow-teal-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {checking ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Checking Status...</span>
                </>
              ) : (
                <>
                  <span>I've Confirmed My Email</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            <button
              onClick={handleResend}
              disabled={resending || cooldown > 0}
              className="w-full py-3.5 px-6 rounded-2xl border-2 border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {resending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-600" />
                  <span>Resending Verification Link...</span>
                </>
              ) : cooldown > 0 ? (
                <>
                  <RefreshCw className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-500">Resend available in {cooldown}s</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 text-slate-600" />
                  <span>Resend Verification Email</span>
                </>
              )}
            </button>
          </div>

          {/* Sign out link */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-center">
            <button
              onClick={handleSignOut}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer py-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign in as a different user</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
