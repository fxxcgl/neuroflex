import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Camera, Play, ShieldAlert, Sparkles, Activity } from 'lucide-react';
import type { Prescription } from '../../types';

interface ExerciseLaunchModalProps {
  isOpen: boolean;
  onClose: () => void;
  prescription: Prescription;
}

export const ExerciseLaunchModal: React.FC<ExerciseLaunchModalProps> = ({
  isOpen,
  onClose,
  prescription,
}) => {
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);

  if (!isOpen) return null;

  const exerciseLabel = prescription.exercise_type === 'knee_extension' 
    ? 'Seated Knee Extension' 
    : 'Active Shoulder Raise';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border-2 border-slate-200 relative animate-in fade-in zoom-in-95 duration-200">
        
        <button
          onClick={onClose}
          type="button"
          className="absolute top-6 right-6 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 touch-target transition-colors"
          aria-label="Close modal"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center border border-teal-200">
            <Camera className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-black uppercase text-teal-700 tracking-wider">AI Computer Vision Session</div>
            <h3 className="text-2xl font-black text-slate-900">{exerciseLabel}</h3>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div className="bg-slate-50 border-2 border-slate-200 p-4 rounded-2xl">
            <h4 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
              <Activity className="w-4 h-4 text-teal-600" /> Prescribed Targets:
            </h4>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <div className="text-xs text-slate-500 font-semibold">Target Angle</div>
                <div className="text-xl font-black text-teal-700">{prescription.target_angle}°</div>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <div className="text-xs text-slate-500 font-semibold">Sets</div>
                <div className="text-xl font-black text-slate-900">{prescription.sets}</div>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <div className="text-xs text-slate-500 font-semibold">Reps / Set</div>
                <div className="text-xl font-black text-slate-900">{prescription.reps}</div>
              </div>
            </div>
          </div>

          <div className="bg-teal-50 border border-teal-200 p-4 rounded-2xl text-xs sm:text-sm text-teal-950 font-medium space-y-2">
            <div className="font-bold flex items-center gap-1.5 text-teal-900">
              <Sparkles className="w-4 h-4 text-teal-700" /> Camera Setup Checklist:
            </div>
            <ul className="space-y-1 list-disc list-inside text-teal-800 text-xs">
              <li>Position device 4-6 feet away so your full body / limb is visible.</li>
              <li>Ensure good lighting and avoid backlight behind you.</li>
              <li>Wear comfortable clothing with clear contrast against background.</li>
            </ul>
          </div>

          <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-900 flex items-center gap-2 font-medium">
            <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
            Your camera stays on this device. Pose tracking runs in the browser and video is not uploaded.
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-1/3 min-h-[52px] rounded-2xl border-2 border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition-colors"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => {
              setStarting(true);
              navigate(`/patient/exercise-session?exercise=${prescription.exercise_type}`);
            }}
            className="w-2/3 min-h-[52px] rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-lg font-black transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
          >
            {starting ? (
              <span className="flex items-center gap-2">
                <Activity className="w-5 h-5 animate-spin" /> Launching AI Vision...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Play className="w-5 h-5 fill-current" /> Begin Workout
              </span>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
