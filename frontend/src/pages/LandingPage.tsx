import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { 
  UserCheck, 
  Stethoscope, 
  ArrowRight
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { t } = useTranslation();

  const handleSelectRole = (role: 'patient' | 'clinician') => {
    if (user && profile) {
      navigate(profile.role === 'clinician' ? '/clinician/dashboard' : '/patient/dashboard');
    } else {
      navigate(`/signup?role=${role}`);
    }
  };

  return (
    <main className="min-h-[calc(100vh-80px)] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto w-full space-y-12">
        
        {/* App Title */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black text-slate-900 tracking-tight">
            NeuroFlex
          </h1>
        </div>

        {/* Two Large Clearly Labeled Action Cards / Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          
          {/* Patient Card */}
          <div className="bg-white rounded-3xl p-8 sm:p-10 border-2 border-sky-200 hover:border-sky-500 shadow-xl flex flex-col justify-between transition-all">
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-sky-50 text-sky-600 border border-sky-200 flex items-center justify-center">
                <UserCheck className="w-8 h-8" />
              </div>
              <h2 className="text-3xl font-extrabold text-slate-900">
                {t('landing.patient_title')}
              </h2>
              <p className="text-slate-600 text-lg leading-relaxed">
                {t('landing.patient_desc')}
              </p>
            </div>

            <div className="mt-8">
              <button
                onClick={() => handleSelectRole('patient')}
                type="button"
                className="w-full min-h-[64px] px-8 py-5 rounded-2xl bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white text-2xl font-black shadow-lg shadow-sky-600/25 transition-all flex items-center justify-center gap-3 focus:ring-4 focus:ring-sky-300"
                aria-label={t('landing.patient_btn')}
              >
                <span>{t('landing.patient_btn')}</span>
                <ArrowRight className="w-7 h-7 stroke-[3]" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Clinician Card */}
          <div className="bg-white rounded-3xl p-8 sm:p-10 border-2 border-emerald-200 hover:border-emerald-500 shadow-xl flex flex-col justify-between transition-all">
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
                <Stethoscope className="w-8 h-8" />
              </div>
              <h2 className="text-3xl font-extrabold text-slate-900">
                {t('landing.clinician_title')}
              </h2>
              <p className="text-slate-600 text-lg leading-relaxed">
                {t('landing.clinician_desc')}
              </p>
            </div>

            <div className="mt-8">
              <button
                onClick={() => handleSelectRole('clinician')}
                type="button"
                className="w-full min-h-[64px] px-8 py-5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-2xl font-black shadow-lg shadow-emerald-700/25 transition-all flex items-center justify-center gap-3 focus:ring-4 focus:ring-emerald-300"
                aria-label={t('landing.clinician_btn')}
              >
                <span>{t('landing.clinician_btn')}</span>
                <ArrowRight className="w-7 h-7 stroke-[3]" aria-hidden="true" />
              </button>
            </div>
          </div>

        </div>

      </div>
    </main>
  );
};
