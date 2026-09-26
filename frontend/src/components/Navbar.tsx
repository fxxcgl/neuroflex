import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Activity, 
  LogOut, 
  User as UserIcon, 
  Type
} from 'lucide-react';
import { LanguageSelector } from './LanguageSelector';
import { useTranslation } from 'react-i18next';

export const Navbar: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'xlarge'>('normal');

  // Font size adjuster for stroke patients
  useEffect(() => {
    const root = document.documentElement;
    if (fontSize === 'normal') {
      root.style.fontSize = '16px';
    } else if (fontSize === 'large') {
      root.style.fontSize = '18px';
    } else if (fontSize === 'xlarge') {
      root.style.fontSize = '20px';
    }
  }, [fontSize]);

  const cycleFontSize = () => {
    if (fontSize === 'normal') setFontSize('large');
    else if (fontSize === 'large') setFontSize('xlarge');
    else setFontSize('normal');
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo & Brand */}
          <Link 
            to="/" 
            className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded-xl p-1"
            aria-label="NeuroFlex Homepage"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-teal-700 to-teal-500 flex items-center justify-center text-white shadow-md shadow-teal-500/20 group-hover:scale-105 transition-transform duration-200">
              <Activity className="w-7 h-7" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-extrabold text-slate-900 tracking-tight">NeuroFlex</span>
              </div>
              <p className="text-xs text-slate-700 font-medium hidden sm:block">{t('navbar.platform', 'Stroke Recovery Platform')}</p>
            </div>
          </Link>

          {/* Right Navigation & Tools */}
          <div className="flex items-center gap-3">
            
            <LanguageSelector />

            {/* Font Size Accessibility Tool */}
            <button
              onClick={cycleFontSize}
              type="button"
              className="touch-target px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-semibold flex items-center gap-2 transition-colors focus:ring-2 focus:ring-teal-600"
              title="Adjust text size for easy reading"
              aria-label={`Adjust text size. Currently ${fontSize}`}
            >
              <Type className="w-4 h-4 text-teal-600" aria-hidden="true" />
              <span className="hidden md:inline">{t('navbar.text_size', 'Text Size:')}</span>
              <span className="uppercase text-xs font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 text-teal-700">
                {fontSize === 'normal' ? '1x' : fontSize === 'large' ? '1.25x' : '1.5x'}
              </span>
            </button>

            {/* If Logged In */}
            {user ? (
              <div className="flex items-center gap-3">
                <Link
                  to={profile?.role === 'clinician' ? '/clinician/dashboard' : '/patient/dashboard'}
                  className="touch-target px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-bold flex items-center gap-2 transition-colors"
                >
                  <UserIcon className="w-4 h-4 text-slate-600" />
                  <span className="hidden sm:inline">
                    {profile?.full_name || (profile?.role === 'clinician' ? t('navbar.clinician', 'Clinician') : t('navbar.patient', 'Patient'))}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    profile?.role === 'clinician' 
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                      : 'bg-sky-100 text-sky-800 border border-sky-300'
                  }`}>
                    {profile?.role === 'clinician' ? t('navbar.clinician', 'Clinician') : profile?.role === 'patient' ? t('navbar.patient', 'Patient') : 'User'}
                  </span>
                </Link>

                <button
                  onClick={handleLogout}
                  type="button"
                  className="touch-target px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-sm font-bold flex items-center gap-2 transition-colors focus:ring-2 focus:ring-red-600"
                  aria-label="Sign out of your account"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('navbar.sign_out', 'Sign Out')}</span>
                </button>
              </div>
            ) : (
              /* If Not Logged In */
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="touch-target px-4 py-2.5 rounded-xl text-slate-700 hover:text-teal-700 hover:bg-slate-100 text-sm font-bold transition-colors"
                >
                  {t('navbar.sign_in', 'Sign In')}
                </Link>
                <Link
                  to="/signup"
                  className="touch-target px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold shadow-sm hover:shadow transition-all flex items-center gap-1.5"
                >
                  {t('navbar.get_started', 'Get Started')}
                </Link>
              </div>
            )}

          </div>

        </div>
      </div>
    </header>
  );
};
