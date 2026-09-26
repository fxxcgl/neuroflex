import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const languages = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'हिन्दी (Hindi)' },
  { code: 'ta', name: 'தமிழ் (Tamil)' },
  { code: 'te', name: 'తెలుగు (Telugu)' },
  { code: 'bn', name: 'বাংলা (Bengali)' },
];

export const LanguageSelector: React.FC = () => {
  const { i18n } = useTranslation();
  // Using useAuth from context, but we need to gracefully handle being outside provider 
  // (though the app wraps everything in AuthProvider, it's good practice)
  let userContext: any = null;
  try {
    userContext = useAuth();
  } catch (e) {
    // ignore
  }

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Set the lang attribute dynamically when language changes
  useEffect(() => {
    document.documentElement.lang = i18n.language;
    // We remove any existing lang-* class and add the new one
    document.body.className = document.body.className.replace(/lang-\w+/g, '').trim() + ` lang-${i18n.language}`;
  }, [i18n.language]);

  const changeLanguage = async (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('neuroflex_language', lng);
    setIsOpen(false);

    if (userContext?.user) {
      try {
        await supabase
          .from('profiles')
          .update({ preferred_language: lng })
          .eq('id', userContext.user.id);
      } catch (err) {
        console.error('Failed to update preferred language in profile', err);
      }
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 text-slate-600 hover:text-teal-600 transition-colors p-2 rounded-lg hover:bg-slate-100"
        title="Change Language"
      >
        <Globe className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-50 max-h-96 overflow-y-auto">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => changeLanguage(lang.code)}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-teal-50 transition-colors ${
                i18n.language === lang.code ? 'text-teal-600 bg-teal-50/50 font-medium' : 'text-slate-700'
              }`}
            >
              {lang.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
