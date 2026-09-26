import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  CATEGORY_OPTIONS,
  getSubOptionsForCategory,
  getInjuryConfig,
  type InjuryConfig
} from '../lib/injuryConfig';
import type { ConditionCategory, PrimaryInjury } from '../types';
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  HeartPulse,
  Sparkles,
  ShieldCheck
} from 'lucide-react';

export const PatientOnboarding: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedCategory, setSelectedCategory] = useState<ConditionCategory | null>(null);
  const [selectedInjury, setSelectedInjury] = useState<PrimaryInjury | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  const subOptions: InjuryConfig[] = selectedCategory
    ? getSubOptionsForCategory(selectedCategory)
    : [];

  const handleCategorySelect = (catId: ConditionCategory) => {
    setSelectedCategory(catId);
    const options = getSubOptionsForCategory(catId);

    // Requirement: "Post-Surgery -> Knee (ACL/Meniscus) — single option, auto-select and skip straight through if there's only one choice"
    if (options.length === 1) {
      setSelectedInjury(options[0].id);
      saveAndProceed(catId, options[0].id);
      return;
    }

    // Default select first sub-option and proceed to Step 2
    if (options.length > 0) {
      setSelectedInjury(options[0].id);
    }
    setStep(2);
  };

  const saveAndProceed = async (
    categoryToSave: ConditionCategory,
    injuryToSave: PrimaryInjury
  ) => {
    setSaving(true);
    const config = getInjuryConfig(injuryToSave);

    try {
      // 1. Cache in localStorage for demo mode / offline resilience
      localStorage.setItem('neuroflex_primary_injury', injuryToSave);
      localStorage.setItem('neuroflex_condition_category', categoryToSave);

      // 2. Persist to database if Supabase configured
      const targetUid = user?.id || profile?.id;
      if (isSupabaseConfigured && targetUid) {
        await supabase.from('patient_profiles').upsert(
          {
            user_id: targetUid,
            condition_category: categoryToSave,
            primary_injury: injuryToSave,
            condition: config.clinicalLabel,
          },
          { onConflict: 'user_id' }
        );
      }
    } catch (err) {
      console.error('Failed to persist onboarding injury:', err);
    } finally {
      setSaving(false);
      navigate('/patient/dashboard');
    }
  };

  const handleConfirmStep2 = () => {
    if (selectedCategory && selectedInjury) {
      saveAndProceed(selectedCategory, selectedInjury);
    }
  };

  const selectedConfig = selectedInjury ? getInjuryConfig(selectedInjury) : null;

  return (
    <div className="min-h-[calc(100vh-80px)] bg-slate-900 text-slate-100 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-3xl mx-auto w-full relative z-10">
        
        {/* Header Badge & Stepper */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-800 text-teal-400 border border-slate-700 text-xs font-bold uppercase tracking-wider mb-3">
            <HeartPulse className="w-4 h-4" /> Patient Recovery Onboarding
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Personalize Your Clinical Therapy
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-400 max-w-lg mx-auto">
            Your selection calibrates AI computer vision joint tracking and assigns your specific range of motion targets.
          </p>

          {/* Stepper indicator */}
          <div className="flex items-center justify-center gap-4 mt-6">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-extrabold ${
                step === 1 ? 'bg-teal-500 text-slate-950 shadow-md' : 'bg-slate-800 text-slate-400'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-slate-950/20 flex items-center justify-center">1</span>
              Recovery Category
            </div>
            <div className="w-6 h-0.5 bg-slate-700" />
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-extrabold ${
                step === 2 ? 'bg-teal-500 text-slate-950 shadow-md' : 'bg-slate-800 text-slate-400'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-slate-950/20 flex items-center justify-center">2</span>
              Target Area
            </div>
          </div>
        </div>

        {/* STEP 1: What are you recovering from? */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center mb-4">
              <h2 className="text-xl font-black text-white">
                Step 1: What are you recovering from?
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Select your primary condition to begin clinical routing.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {CATEGORY_OPTIONS.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategorySelect(cat.id)}
                    className={`p-6 rounded-3xl border-2 text-left transition-all duration-150 flex flex-col justify-between group ${
                      isSelected
                        ? 'bg-slate-800 border-teal-400 shadow-xl ring-2 ring-teal-400/50'
                        : 'bg-slate-800/60 border-slate-700 hover:border-slate-500 hover:bg-slate-800'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-4xl p-2.5 rounded-2xl bg-slate-900 border border-slate-700">
                          {cat.icon}
                        </span>
                        <div
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                            isSelected
                              ? 'border-teal-400 bg-teal-400 text-slate-950'
                              : 'border-slate-600 group-hover:border-slate-400'
                          }`}
                        >
                          {isSelected && <CheckCircle2 className="w-4 h-4" />}
                        </div>
                      </div>
                      <h3 className="text-lg font-black text-white group-hover:text-teal-300 transition-colors">
                        {cat.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
                        {cat.shortDesc}
                      </p>
                    </div>

                    <div className="mt-5 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs font-bold text-teal-400">
                      <span>{cat.id === 'post_surgery' ? 'Auto-selects Knee (ACL/Meniscus)' : 'Select area in Step 2'}</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 2: Which area? */}
        {step === 2 && selectedCategory && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white transition-colors mb-1"
                >
                  <ChevronLeft className="w-4 h-4" /> Back to Categories
                </button>
                <h2 className="text-xl font-black text-white">
                  Step 2: Which area?
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  Category:{' '}
                  <span className="text-teal-400 font-bold">
                    {CATEGORY_OPTIONS.find((c) => c.id === selectedCategory)?.title}
                  </span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {subOptions.map((opt) => {
                const isSelected = selectedInjury === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedInjury(opt.id)}
                    className={`p-6 rounded-3xl border-2 text-left transition-all duration-150 flex flex-col justify-between group ${
                      isSelected
                        ? 'bg-slate-800 border-teal-400 shadow-xl ring-2 ring-teal-400/50'
                        : 'bg-slate-800/60 border-slate-700 hover:border-slate-500 hover:bg-slate-800'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-3xl p-2 rounded-2xl bg-slate-900 border border-slate-700">
                          {opt.icon}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-700 text-teal-300">
                          {opt.focalJoint}
                        </span>
                      </div>
                      <h3 className="text-lg font-black text-white group-hover:text-teal-300 transition-colors">
                        {opt.subOptionLabel}
                      </h3>
                      <p className="text-xs font-semibold text-teal-400 mt-1">
                        {opt.clinicalLabel}
                      </p>
                      <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">
                        {opt.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400">
                      <span>Target: {opt.defaultTargetAngle}°</span>
                      <span>{opt.defaultSets} sets × {opt.defaultReps} reps</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Confirmation Action */}
            {selectedConfig && (
              <div className="p-5 rounded-2xl bg-teal-950/40 border border-teal-800 flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{selectedConfig.icon}</span>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-teal-400">
                      Selected Clinical Program
                    </div>
                    <div className="text-sm sm:text-base font-black text-white">
                      {selectedConfig.badgeLabel}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleConfirmStep2}
                  disabled={saving}
                  className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-teal-400 hover:bg-teal-300 active:bg-teal-500 text-slate-950 font-black text-sm shadow-lg shadow-teal-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Confirm & Launch Dashboard'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default PatientOnboarding;
