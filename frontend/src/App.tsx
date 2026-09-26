import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { PatientDashboard } from './pages/PatientDashboard';
import { ClinicianDashboard } from './pages/ClinicianDashboard';
import { ExerciseSessionPage } from './pages/ExerciseSessionPage';
import { PatientOnboarding } from './pages/PatientOnboarding';
import { VerifyEmailPage } from './pages/VerifyEmailPage';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
          <Navbar />
          <div className="flex-1">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<AuthPage initialMode="login" />} />
              <Route path="/signup" element={<AuthPage initialMode="signup" />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />

              {/* Protected Role-Based Routes */}
              <Route
                path="/patient/onboarding"
                element={
                  <ProtectedRoute allowedRole="patient">
                    <PatientOnboarding />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/patient/dashboard"
                element={
                  <ProtectedRoute allowedRole="patient">
                    <PatientDashboard />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/patient/exercise-session"
                element={
                  <ProtectedRoute allowedRole="patient">
                    <ExerciseSessionPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/clinician/dashboard"
                element={
                  <ProtectedRoute allowedRole="clinician">
                    <ClinicianDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Catch-all redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
