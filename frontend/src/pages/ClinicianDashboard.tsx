import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { updatePatientPrescription } from '../lib/mockData';
import type { MockPatientDetail } from '../lib/mockData';
import type { ExerciseType, Appointment } from '../types';
import { fetchClinicianCaseload, updateClinicianPrescription } from '../lib/clinicianService';
import { getInjuryConfig } from '../lib/injuryConfig';
import {
  fetchAppointments,
  updateAppointmentStatus
} from '../lib/appointmentService';
import {
  Stethoscope,
  Activity,
  AlertTriangle,
  Clock,
  ChevronRight,
  X,
  Edit3,
  Save,
  Check,
  MessageSquare,
  Calendar,
  CheckCircle2,
  XCircle,
  Users,
  Video,
  ShieldCheck
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { MessageModal } from '../components/modals/MessageModal';
import { VideoCallModal } from '../components/modals/VideoCallModal';

export const ClinicianDashboard: React.FC = () => {
  const { profile, user, isSupabaseConfigured } = useAuth();
  const { t } = useTranslation();
  const [patients, setPatients] = useState<MockPatientDetail[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(true);

  // Chat & Appointment state
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [isVideoModalOpen, setVideoModalOpen] = useState<boolean>(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const resolvedClinicianId = user?.id || profile?.id;
  const clinicianId = isSupabaseConfigured
    ? (resolvedClinicianId || '')
    : (resolvedClinicianId || 'c-001');

  // Form State for updating prescription
  const selectedPatient = patients.find(p => p.id === selectedPatientId) || patients[0] || null;

  const [formExerciseType, setFormExerciseType] = useState<ExerciseType>('knee_extension');
  const [formTargetAngle, setFormTargetAngle] = useState<number>(110);
  const [formSets, setFormSets] = useState<number>(3);
  const [formReps, setFormReps] = useState<number>(10);
  const [formFrequency, setFormFrequency] = useState<number>(5);
  const [formNotes, setFormNotes] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Load real caseload & appointments
  useEffect(() => {
    if (isSupabaseConfigured && !clinicianId) return;

    let isMounted = true;
    setLoading(true);

    fetchClinicianCaseload(clinicianId).then((list) => {
      if (isMounted) {
        setPatients(list);
        if (list.length > 0) {
          setSelectedPatientId(list[0].id);
          setFormExerciseType(list[0].prescription.exercise_type);
          setFormTargetAngle(list[0].prescription.target_angle);
          setFormSets(list[0].prescription.sets);
          setFormReps(list[0].prescription.reps);
          setFormFrequency(list[0].prescription.frequency_per_week);
          setFormNotes(list[0].prescription.notes || '');
        }
        setLoading(false);
      }
    });

    fetchAppointments(clinicianId, 'clinician').then((apts) => {
      if (isMounted) setAppointments(apts);
    });

    const handleFocus = () => {
      if (isSupabaseConfigured && !clinicianId) return;
      fetchClinicianCaseload(clinicianId).then((list) => {
        if (isMounted) {
          setPatients(list);
          if (list.length > 0 && !list.some(p => p.id === selectedPatientId)) {
            setSelectedPatientId(list[0].id);
          }
        }
      });
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleFocus);
    };
  }, [clinicianId, isSupabaseConfigured]);

  // Synchronize form when patient selection changes
  const handleSelectPatient = (patient: MockPatientDetail) => {
    setSelectedPatientId(patient.id);
    setIsDetailOpen(true);
    const config = getInjuryConfig(patient.primaryInjury);
    setFormExerciseType(config.exerciseType);
    setFormTargetAngle(patient.prescription.target_angle);
    setFormSets(patient.prescription.sets);
    setFormReps(patient.prescription.reps);
    setFormFrequency(patient.prescription.frequency_per_week);
    setFormNotes(patient.prescription.notes || '');
    setSaveSuccess(false);
  };

  const handleSavePrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;

    await updateClinicianPrescription(selectedPatient.id, clinicianId, {
      exercise_type: formExerciseType,
      target_angle: Number(formTargetAngle),
      sets: Number(formSets),
      reps: Number(formReps),
      frequency_per_week: Number(formFrequency),
      notes: formNotes,
    });

    const updatedList = updatePatientPrescription(selectedPatient.id, {
      exercise_type: formExerciseType,
      target_angle: Number(formTargetAngle),
      sets: Number(formSets),
      reps: Number(formReps),
      frequency_per_week: Number(formFrequency),
      notes: formNotes,
    });
    setPatients(updatedList);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleAppointmentAction = async (appointmentId: string, newStatus: 'confirmed' | 'cancelled' | 'completed') => {
    await updateAppointmentStatus(appointmentId, newStatus);
    setAppointments((prev) =>
      prev.map((a) => (a.id === appointmentId ? { ...a, status: newStatus } : a))
    );
  };

  // Helper for compliance badge color coding: Green >80%, Yellow 50-80%, Red <50%
  const getComplianceColor = (compliance: number) => {
    if (compliance >= 80) {
      return {
        badge: 'bg-emerald-100 text-emerald-900 border-emerald-300',
        text: 'text-emerald-700',
        dot: 'bg-emerald-600',
        label: t('clinician.optimal', 'Optimal'),
      };
    } else if (compliance >= 50) {
      return {
        badge: 'bg-amber-100 text-amber-900 border-amber-300',
        text: 'text-amber-700',
        dot: 'bg-amber-500',
        label: t('clinician.moderate', 'Moderate'),
      };
    } else {
      return {
        badge: 'bg-red-100 text-red-900 border-red-300',
        text: 'text-red-700',
        dot: 'bg-red-600',
        label: t('clinician.at_risk', 'At Risk'),
      };
    }
  };

  if (loading && patients.length === 0) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 flex flex-col items-center justify-center space-y-4">
        <Activity className="w-10 h-10 text-emerald-600 animate-spin" />
        <p className="text-slate-600 font-bold text-base">{t('clinician.loading', 'Loading clinician caseload & telemetry...')}</p>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">

      {/* Header Banner */}
      <section className="bg-gradient-to-r from-emerald-900 via-teal-950 to-slate-900 rounded-3xl p-6 sm:p-10 text-white shadow-xl border-2 border-emerald-700/40 relative overflow-hidden">
        <div className="absolute -right-12 -bottom-12 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/20 text-emerald-200 text-xs sm:text-sm font-bold backdrop-blur-sm border border-emerald-400/30">
              <Stethoscope className="w-4 h-4 text-emerald-300" /> {t('clinician.portal_title', 'NeuroFlex Clinician Portal')}
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white">
              {profile?.full_name || 'Dr. Sarah Chen, PT, DPT'}
            </h1>
            <p className="text-emerald-100 text-base sm:text-lg font-medium">
              {t('clinician.subtitle', 'Stroke Tele-Rehabilitation Caseload & Kinematic Telemetry')}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-emerald-950/80 px-4 py-2.5 rounded-2xl border border-emerald-700/60 text-center">
              <div className="text-xs text-emerald-300 font-bold uppercase">{t('clinician.caseload', 'Caseload')}</div>
              <div className="text-2xl font-black text-white">{t('clinician.patients_count', { count: patients.length, defaultValue: `{{count}} Patients` })}</div>
            </div>
            <div className="bg-emerald-950/80 px-4 py-2.5 rounded-2xl border border-emerald-700/60 text-center">
              <div className="text-xs text-amber-300 font-bold uppercase">{t('clinician.risk_alerts', 'Risk Alerts')}</div>
              <div className="text-2xl font-black text-amber-400">
                {t('clinician.active_count', { count: patients.filter(p => p.riskAlert).length, defaultValue: '{{count}} Active' })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Grid: Caseload Table + Patient Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* Caseload Table Column (5 cols on wide, or full if detail closed) */}
        <section
          className={`bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-200 shadow-md transition-all ${isDetailOpen ? 'lg:col-span-5' : 'lg:col-span-12'
            }`}
          aria-label="Patient Caseload"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-black text-slate-900">{t('clinician.caseload_title', 'Patient Caseload')}</h2>
              <p className="text-slate-500 text-xs sm:text-sm font-medium">{t('clinician.select_patient', 'Select a patient to inspect telemetry and update prescription')}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-200 text-xs font-black uppercase text-slate-500 tracking-wider">
                  <th className="pb-3 px-3">{t('clinician.patient_header', 'Patient')}</th>
                  <th className="pb-3 px-3">{t('clinician.status_header', 'Status')}</th>
                  <th className="pb-3 px-3 hidden sm:table-cell">{t('clinician.adherence_header', 'Adherence')}</th>
                  <th className="pb-3 px-3 hidden sm:table-cell text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {patients.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 px-4 text-center text-slate-500">
                      <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="font-bold text-slate-700">No Patients in Caseload Yet</p>
                      <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
                        When patients sign up and select you as their care provider, their telemetry and kinematics will appear here.
                      </p>
                    </td>
                  </tr>
                ) : (
                  patients.map((p) => {
                    const style = getComplianceColor(p.compliance);
                    const isSelected = selectedPatient?.id === p.id && isDetailOpen;

                    return (
                      <tr
                        key={p.id}
                        onClick={() => handleSelectPatient(p)}
                        className={`cursor-pointer transition-all ${isSelected
                            ? 'bg-emerald-50/90 font-bold border-l-4 border-l-emerald-600'
                            : 'hover:bg-slate-50/80 font-medium'
                          }`}
                      >
                        <td className="py-4 px-3">
                          <div className="font-extrabold text-slate-900 text-sm sm:text-base leading-tight">
                            {p.name}
                          </div>
                          <div className="text-xs text-slate-500 font-medium truncate max-w-full">
                            <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              <ShieldCheck className="w-3 h-3" />
                              {getInjuryConfig(p.primaryInjury).badgeLabel}
                            </span>
                          </div>
                        </td>

                        <td className="py-4 px-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold border ${style.badge}`}>
                            <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                            {p.compliance}%
                          </span>
                        </td>

                        <td className="py-4 px-3 text-xs sm:text-sm font-semibold text-slate-700">
                          {p.recoveryStage}
                        </td>

                        <td className="py-4 px-3 text-center">
                          {p.riskAlert ? (
                            <div
                              className="inline-flex items-center justify-center p-1.5 rounded-xl bg-amber-100 text-amber-800 border border-amber-300"
                              title={p.riskAlert.message}
                            >
                              <AlertTriangle className="w-4 h-4 text-amber-700" />
                            </div>
                          ) : (
                            <span className="text-slate-300 text-xs font-bold">—</span>
                          )}
                        </td>

                        <td className="py-4 px-2 text-right text-slate-400">
                          <ChevronRight className={`w-5 h-5 transition-transform ${isSelected ? 'text-emerald-700 translate-x-1' : ''}`} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Patient Detail Panel (7 cols on wide) */}
        {isDetailOpen && selectedPatient && (
          <section className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-emerald-200 shadow-xl lg:col-span-7 space-y-6 animate-in fade-in duration-200" aria-label="Patient Detail & Telemetry">

            {/* Header & Risk Alert */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                    {selectedPatient.name}
                  </h2>
                  <span className={`px-3 py-1 rounded-full text-xs font-extrabold border ${getComplianceColor(selectedPatient.compliance).badge}`}>
                    {selectedPatient.compliance}% Weekly Adherence
                  </span>
                </div>
                <p className="text-slate-600 text-sm font-semibold mt-1">
                  {selectedPatient.condition} • <strong>{selectedPatient.recoveryStage}</strong>
                </p>
              </div>

              {/* Action Buttons: Message Patient & Close */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsChatOpen(true)}
                  className="touch-target px-4 py-2 rounded-2xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-all"
                  aria-label="Open chat thread with patient"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Message</span>
                </button>

                <button
                  type="button"
                  onClick={() => setVideoModalOpen(true)}
                  className="touch-target px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-all"
                  aria-label="Start Video Call with patient"
                >
                  <Video className="w-4 h-4" />
                  <span>Video Call</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsDetailOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors lg:hidden"
                  aria-label="Close detail panel"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Risk Alert Box if flagged */}
            {selectedPatient.riskAlert && (
              <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-extrabold text-sm text-amber-900 uppercase tracking-wide">
                    Kinematic Risk Flag ({selectedPatient.riskAlert.date}):
                  </div>
                  <p className="text-sm font-semibold text-amber-900 mt-0.5">
                    {selectedPatient.riskAlert.message}
                  </p>
                </div>
              </div>
            )}

            {/* 1. Angle Deviation Chart (Recharts) */}
            <div className="bg-slate-50 p-5 rounded-3xl border-2 border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-teal-600" />
                    Repetition Angle Deviation Analysis
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold">
                    Target Goal vs. Measured Extension (Last Session)
                  </p>
                </div>
                <span className="text-xs font-bold bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700">
                  Target: {selectedPatient.prescription.target_angle}°
                </span>
              </div>

              {selectedPatient.angleDeviationData.length === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center text-center p-4 border-2 border-dashed border-slate-300 rounded-2xl">
                  <Activity className="w-8 h-8 text-slate-300 mb-1" />
                  <p className="text-sm font-bold text-slate-700">No session telemetry recorded yet</p>
                  <p className="text-xs text-slate-500">Repetition angle breakdown will appear once this patient records their first session.</p>
                </div>
              ) : (
                <div className="h-56 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={selectedPatient.angleDeviationData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="repNumber" tickFormatter={(val) => `Rep ${val}`} stroke="#64748b" fontSize={11} fontWeight={700} />
                      <YAxis domain={[50, 130]} stroke="#64748b" fontSize={11} fontWeight={700} tickFormatter={(val) => `${val}°`} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const d = payload[0].payload;
                            return (
                              <div className="bg-slate-900 text-white p-2.5 rounded-xl text-xs space-y-0.5 shadow-lg border border-slate-700">
                                <p className="font-bold text-teal-300">Repetition {d.repNumber}</p>
                                <p className="font-black text-white">Angle: {d.measuredAngle}°</p>
                                <p className="text-slate-300">Goal: {d.prescribedAngle}°</p>
                                <p className={d.deviation >= 0 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                                  Deviation: {d.deviation > 0 ? `+${d.deviation}°` : `${d.deviation}°`}
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <ReferenceLine y={selectedPatient.prescription.target_angle} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={2} />
                      <Bar dataKey="measuredAngle" fill="#0d9488" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* 2. Compensatory Movement Flags & Recent Session History */}
            <div className="space-y-3">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-700" />
                Session History & Compensatory Movement Telemetry
              </h3>

              {selectedPatient.sessionsHistory.length === 0 ? (
                <div className="p-5 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-300 text-center text-slate-500">
                  <p className="text-sm font-bold text-slate-700">No session history yet</p>
                  <p className="text-xs text-slate-500">Completed workouts with duration and posture metrics will appear here.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {selectedPatient.sessionsHistory.map((sess) => (
                    <div key={sess.id} className="p-4 rounded-2xl bg-white border-2 border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-sm">{sess.exerciseType}</span>
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold">{sess.date}</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1 font-medium">
                          Reps: <strong>{sess.repsCompleted}/{sess.targetReps}</strong> • Peak ROM: <strong>{sess.avgRom}°</strong> • Duration: {sess.durationMinutes}m
                        </div>
                      </div>

                      {/* Compensatory Flags */}
                      <div className="flex flex-wrap gap-1.5">
                        {sess.compensationFlags.map((flag, idx) => (
                          <span
                            key={idx}
                            className={`text-xs px-2.5 py-1 rounded-lg font-bold border ${flag.toLowerCase().includes('lean') || flag.toLowerCase().includes('tremor') || flag.toLowerCase().includes('shift') || flag.toLowerCase().includes('fatigue')
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              }`}
                          >
                            {flag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Prescription Form (Exercise Parameters) */}
            <div className="bg-emerald-50/80 p-6 rounded-3xl border-2 border-emerald-300 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-emerald-950 flex items-center gap-2">
                    <Edit3 className="w-5 h-5 text-emerald-700" />
                    Update Exercise Prescription
                  </h3>
                  <p className="text-xs text-emerald-800 font-semibold">
                    Parameters instantly synchronize with patient's dashboard
                  </p>
                </div>
                {saveSuccess && (
                  <div className="flex items-center gap-1 text-xs font-black bg-emerald-600 text-white px-3 py-1.5 rounded-xl shadow-sm animate-in fade-in">
                    <Check className="w-4 h-4" /> Prescription Saved!
                  </div>
                )}
              </div>

              <form onSubmit={handleSavePrescription} className="space-y-4">

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  {/* Exercise Type */}
                  <div>
                    <label htmlFor="ex-type" className="block text-xs font-black text-emerald-950 uppercase mb-1">
                      Exercise Routine
                    </label>
                    <div className="w-full min-h-[48px] px-3.5 bg-emerald-50 border-2 border-emerald-200 rounded-xl text-emerald-900 font-bold flex items-center">
                      {getInjuryConfig(selectedPatient?.primaryInjury).clinicalLabel}
                    </div>
                  </div>

                  {/* Target Angle */}
                  <div>
                    <label htmlFor="tg-angle" className="block text-xs font-black text-emerald-950 uppercase mb-1">
                      Target ROM Angle (Degrees)
                    </label>
                    <div className="relative">
                      <input
                        id="tg-angle"
                        type="number"
                        min="30"
                        max="180"
                        required
                        value={formTargetAngle}
                        onChange={(e) => setFormTargetAngle(Number(e.target.value))}
                        className="w-full min-h-[48px] px-3.5 bg-white border-2 border-emerald-300 rounded-xl text-slate-900 font-bold focus:border-emerald-700 focus:outline-none"
                      />
                      <span className="absolute right-3.5 top-3 text-slate-500 font-bold text-sm">°</span>
                    </div>
                  </div>

                </div>

                <div className="grid grid-cols-3 gap-3">

                  {/* Sets */}
                  <div>
                    <label htmlFor="ex-sets" className="block text-xs font-black text-emerald-950 uppercase mb-1">
                      Sets
                    </label>
                    <input
                      id="ex-sets"
                      type="number"
                      min="1"
                      max="10"
                      required
                      value={formSets}
                      onChange={(e) => setFormSets(Number(e.target.value))}
                      className="w-full min-h-[48px] px-3 bg-white border-2 border-emerald-300 rounded-xl text-slate-900 font-bold text-center focus:border-emerald-700 focus:outline-none"
                    />
                  </div>

                  {/* Reps */}
                  <div>
                    <label htmlFor="ex-reps" className="block text-xs font-black text-emerald-950 uppercase mb-1">
                      Reps / Set
                    </label>
                    <input
                      id="ex-reps"
                      type="number"
                      min="1"
                      max="50"
                      required
                      value={formReps}
                      onChange={(e) => setFormReps(Number(e.target.value))}
                      className="w-full min-h-[48px] px-3 bg-white border-2 border-emerald-300 rounded-xl text-slate-900 font-bold text-center focus:border-emerald-700 focus:outline-none"
                    />
                  </div>

                  {/* Frequency per week */}
                  <div>
                    <label htmlFor="ex-freq" className="block text-xs font-black text-emerald-950 uppercase mb-1">
                      Freq (Days/Wk)
                    </label>
                    <input
                      id="ex-freq"
                      type="number"
                      min="1"
                      max="7"
                      required
                      value={formFrequency}
                      onChange={(e) => setFormFrequency(Number(e.target.value))}
                      className="w-full min-h-[48px] px-3 bg-white border-2 border-emerald-300 rounded-xl text-slate-900 font-bold text-center focus:border-emerald-700 focus:outline-none"
                    />
                  </div>

                </div>

                {/* Clinical Notes */}
                <div>
                  <label htmlFor="ex-notes" className="block text-xs font-black text-emerald-950 uppercase mb-1">
                    Clinical Notes & Guidance for Patient
                  </label>
                  <textarea
                    id="ex-notes"
                    rows={2}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="e.g. Focus on terminal extension and maintain trunk posture..."
                    className="w-full p-3 bg-white border-2 border-emerald-300 rounded-xl text-slate-900 font-medium text-sm focus:border-emerald-700 focus:outline-none resize-none"
                  />
                </div>

                {/* Save Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full min-h-[52px] rounded-2xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-base font-black shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 focus:ring-4 focus:ring-emerald-300"
                  >
                    <Save className="w-5 h-5" />
                    <span>Save & Update Prescription</span>
                  </button>
                </div>

              </form>
            </div>

          </section>
        )}

      </div>

      {/* 4. Appointments Management Section */}
      <section className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-200 shadow-md space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-6 h-6 text-teal-700" />
            <div>
              <h2 className="text-2xl font-black text-slate-900">Tele-Consultation Appointments</h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Review and confirm incoming patient video session requests
              </p>
            </div>
          </div>
          <span className="text-xs font-black uppercase tracking-wider bg-slate-100 text-slate-700 px-3 py-1 rounded-full">
            {appointments.filter(a => a.status === 'pending').length} Pending Requests
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {appointments.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs font-semibold">
              No appointments on file.
            </div>
          ) : (
            appointments.map((apt) => {
              const matchedPatient = patients.find(p => p.id === apt.patient_id);
              const patientName = matchedPatient ? matchedPatient.name : 'Patient ' + apt.patient_id;
              const dateObj = new Date(apt.scheduled_at);
              const formattedDate = isNaN(dateObj.getTime())
                ? apt.scheduled_at
                : dateObj.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) +
                ' at ' +
                dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <div key={apt.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-extrabold text-slate-900 text-sm sm:text-base">{patientName}</span>
                      <span className={`px-2.5 py-0.5 rounded-full uppercase text-[10px] font-black border ${apt.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                          apt.status === 'pending' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                            apt.status === 'completed' ? 'bg-sky-100 text-sky-800 border-sky-300' :
                              'bg-red-100 text-red-800 border-red-300'
                        }`}>
                        {apt.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" /> {formattedDate}
                    </div>
                  </div>

                  {/* Actions for Clinician */}
                  <div className="flex items-center gap-2">
                    {apt.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleAppointmentAction(apt.id, 'confirmed')}
                          className="touch-target px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAppointmentAction(apt.id, 'cancelled')}
                          className="touch-target px-3.5 py-2 rounded-xl border border-red-300 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs flex items-center gap-1.5 transition-all"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Cancel
                        </button>
                      </>
                    )}

                    {apt.status === 'confirmed' && (
                      <button
                        type="button"
                        onClick={() => handleAppointmentAction(apt.id, 'completed')}
                        className="touch-target px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
                      >
                        <Check className="w-3.5 h-3.5" /> Mark Completed
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* 5. Payment Accounts Settings */}
      <section className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-200 shadow-md space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <Activity className="w-6 h-6 text-teal-700" /> Payment Accounts
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
              Connect your payment gateways to receive subscription payouts directly from your patients.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Stripe Card */}
          <div className="p-5 border-2 border-slate-200 rounded-2xl flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-black text-xl">S</div>
            <h3 className="font-bold text-slate-900">Stripe Connect</h3>
            <p className="text-xs text-slate-500">Receive payouts directly to your bank account via Stripe.</p>
            <button
              onClick={async () => {
                const res = await fetch('/api/payments/onboard', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ doctorId: clinicianId, gateway: 'stripe' })
                });
                const data = await res.json();
                if (data.url) window.location.href = data.url;
              }}
              className="mt-auto w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-colors"
            >
              Connect Stripe
            </button>
          </div>

          {/* Razorpay Card */}
          <div className="p-5 border-2 border-slate-200 rounded-2xl flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-black text-xl">R</div>
            <h3 className="font-bold text-slate-900">Razorpay Route</h3>
            <p className="text-xs text-slate-500">Receive payouts in India via Razorpay Route accounts.</p>
            <button
              onClick={async () => {
                const res = await fetch('/api/payments/onboard', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ doctorId: clinicianId, gateway: 'razorpay' })
                });
                const data = await res.json();
                if (data.url) window.location.href = data.url;
              }}
              className="mt-auto w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors"
            >
              Connect Razorpay
            </button>
          </div>

          {/* PayPal Card */}
          <div className="p-5 border-2 border-slate-200 rounded-2xl flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 bg-sky-50 text-sky-600 rounded-full flex items-center justify-center font-black text-xl">P</div>
            <h3 className="font-bold text-slate-900">PayPal Payouts</h3>
            <p className="text-xs text-slate-500">Receive international payouts directly to your PayPal account.</p>
            <button
              onClick={async () => {
                const res = await fetch('/api/payments/onboard', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ doctorId: clinicianId, gateway: 'paypal' })
                });
                const data = await res.json();
                if (data.url) window.location.href = data.url;
              }}
              className="mt-auto w-full py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-sm transition-colors"
            >
              Connect PayPal
            </button>
          </div>
        </div>
      </section>

      {/* Practitioner Connect Message Modal */}
      {isChatOpen && selectedPatient && (
        <MessageModal
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          currentUserId={clinicianId}
          recipientId={selectedPatient.id}
          recipientName={selectedPatient.name}
          recipientRole="Patient"
        />
      )}

      {/* Video Call Modal */}
      {isVideoModalOpen && selectedPatient && (
        <VideoCallModal
          isOpen={isVideoModalOpen}
          onClose={() => setVideoModalOpen(false)}
          roomName={`Neuroflex_Call_${selectedPatient.id}_${clinicianId}`}
          userName={profile?.full_name || 'Dr. Sarah Chen, PT'}
        />
      )}

    </main>
  );
};
