import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, CheckCircle2, Video, Plus } from 'lucide-react';
import { fetchAppointments, requestAppointment } from '../../lib/appointmentService';
import type { Appointment } from '../../types';

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  clinicianId: string;
  clinicianName: string;
}

export const AppointmentModal: React.FC<AppointmentModalProps> = ({
  isOpen,
  onClose,
  patientId,
  clinicianId,
  clinicianName,
}) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date(Date.now() + 86400000 * 2);
    return d.toISOString().split('T')[0];
  });
  const [selectedTime, setSelectedTime] = useState('10:30 AM');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetchAppointments(patientId, 'patient').then(setAppointments);
  }, [isOpen, patientId]);

  if (!isOpen) return null;

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    // Combine date & time into ISO string
    const [hours, minutesPart] = selectedTime.split(':');
    const minutes = minutesPart.split(' ')[0];
    const isPM = selectedTime.includes('PM');
    const hourNum = isPM && hours !== '12' ? parseInt(hours, 10) + 12 : hours === '12' && !isPM ? 0 : parseInt(hours, 10);
    
    const combinedIso = `${selectedDate}T${String(hourNum).padStart(2, '0')}:${minutes}:00Z`;

    const newApt = await requestAppointment(patientId, clinicianId, combinedIso);
    setAppointments((prev) => [...prev, newApt]);
    setSubmitting(false);
    setSuccessMessage('Appointment request submitted! Your clinician will review and confirm.');

    setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);
  };

  const times = ['09:00 AM', '10:30 AM', '02:00 PM', '04:30 PM'];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'pending':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'completed':
        return 'bg-sky-100 text-sky-800 border-sky-300';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border-2 border-slate-200 relative max-h-[90vh] overflow-y-auto space-y-6 animate-in zoom-in-95 duration-200">
        
        <button
          onClick={onClose}
          type="button"
          className="absolute top-6 right-6 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 touch-target transition-colors"
          aria-label="Close booking modal"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-800 flex items-center justify-center border border-sky-200">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-slate-900">Tele-Rehab Consultation Scheduling</h3>
            <p className="text-sm text-slate-500 font-medium">With {clinicianName}</p>
          </div>
        </div>

        {successMessage && (
          <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-900 flex items-start gap-3 text-sm font-semibold">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>{successMessage}</div>
          </div>
        )}

        {/* Existing Appointments List */}
        <div className="space-y-3">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
            Your Scheduled & Pending Appointments ({appointments.length})
          </h4>

          {appointments.length === 0 ? (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center font-medium">
              No appointments scheduled yet. Select a date below to request your tele-consultation.
            </div>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {appointments.map((apt) => {
                const dateObj = new Date(apt.scheduled_at);
                const dateString = isNaN(dateObj.getTime())
                  ? apt.scheduled_at
                  : dateObj.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) +
                    ' at ' +
                    dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                return (
                  <div
                    key={apt.id}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs font-semibold"
                  >
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-4 h-4 text-sky-600 shrink-0" />
                      <span>{dateString}</span>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-full uppercase text-[10px] font-black border ${getStatusBadge(apt.status)}`}>
                      {apt.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Request New Appointment Form */}
        <form onSubmit={handleBook} className="space-y-4 pt-4 border-t border-slate-200">
          <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-teal-600" /> Request New Appointment Slot:
          </h4>

          <div>
            <label htmlFor="apt-date" className="block text-xs font-bold text-slate-700 mb-1.5">
              Select Preferred Date:
            </label>
            <input
              id="apt-date"
              type="date"
              required
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full min-h-[48px] px-4 bg-slate-50 border-2 border-slate-300 rounded-2xl text-slate-900 font-semibold focus:bg-white focus:border-teal-600 focus:outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Select Preferred Time:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {times.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSelectedTime(t)}
                  className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all flex items-center justify-center gap-1.5 ${
                    selectedTime === t
                      ? 'border-sky-600 bg-sky-50 text-sky-950 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 text-sky-600" /> {t}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-sky-50 p-3.5 rounded-2xl border border-sky-200 text-xs text-sky-950 flex items-center gap-2.5 font-medium">
            <Video className="w-4 h-4 text-sky-600 shrink-0" />
            Includes live video consult with real-time posture & kinematic motion analysis review.
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 min-h-[48px] rounded-2xl border-2 border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition-colors text-sm"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="w-2/3 min-h-[48px] rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-bold transition-all shadow-md flex items-center justify-center gap-2 text-sm"
            >
              <Calendar className="w-4 h-4" />
              <span>{submitting ? 'Submitting...' : 'Submit Booking Request'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
