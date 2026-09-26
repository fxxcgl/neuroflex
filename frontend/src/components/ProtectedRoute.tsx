import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';
import { Activity } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole?: UserRole;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRole }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div 
        className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center"
        role="status"
        aria-live="polite"
      >
        <div className="w-16 h-16 rounded-2xl bg-teal-50 border-2 border-teal-500/20 flex items-center justify-center mb-4 shadow-sm animate-pulse">
          <Activity className="w-8 h-8 text-teal-600 animate-spin" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Verifying your secure session...</h2>
        <p className="text-slate-500 text-sm mt-1">Please hold on a moment.</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Requirement 1: Check if user's email is confirmed
  // Block access to /patient/* and /clinician/* if unverified
  if (user && !user.email_confirmed_at) {
    return <Navigate to="/verify-email" state={{ email: user.email }} replace />;
  }

  if (user && !profile) {
    return (
      <div
        className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center"
        role="status"
        aria-live="polite"
      >
        <div className="w-16 h-16 rounded-2xl bg-teal-50 border-2 border-teal-500/20 flex items-center justify-center mb-4 shadow-sm animate-pulse">
          <Activity className="w-8 h-8 text-teal-600 animate-spin" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Loading your profile...</h2>
        <p className="text-slate-500 text-sm mt-1">Please hold on a moment.</p>
      </div>
    );
  }

  // If role is loaded and doesn't match allowedRole, send them to their role dashboard
  if (allowedRole && profile?.role && profile.role !== allowedRole) {
    const targetPath = profile.role === 'clinician' ? '/clinician/dashboard' : '/patient/dashboard';
    return <Navigate to={targetPath} replace />;
  }

  return <>{children}</>;
};
