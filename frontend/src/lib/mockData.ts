import type { Prescription } from '../types';

export interface MockPatientDetail {
  id: string;
  name: string;
  email: string;
  condition: string;
  conditionCategory: string | null;
  primaryInjury: string | null;
  recoveryStage: string;
  compliance: number; // percentage e.g. 88
  assignedClinician: {
    id: string;
    name: string;
    credentials: string;
    specialty: string;
  };
  riskAlert?: {
    type: 'warning' | 'critical';
    message: string;
    date: string;
  } | null;
  prescription: Prescription;
  romHistory: {
    session: string;
    date: string;
    romAngle: number;
    targetAngle: number;
    targetMet: boolean;
  }[];
  sessionsHistory: {
    id: string;
    exerciseType: string;
    date: string;
    durationMinutes: number;
    repsCompleted: number;
    targetReps: number;
    avgRom: number;
    compensationFlags: string[];
  }[];
  angleDeviationData: {
    repNumber: number;
    measuredAngle: number;
    prescribedAngle: number;
    deviation: number;
  }[];
}

export const initialMockPatients: MockPatientDetail[] = [
  {
    id: 'p-001',
    name: 'Robert Miller',
    email: 'robert.patient@example.com',
    condition: 'Left Hemiparesis (Ischemic Stroke)',
    conditionCategory: 'stroke',
    primaryInjury: 'stroke_knee',
    recoveryStage: 'Subacute (Day 42)',
    compliance: 85,
    assignedClinician: {
      id: 'c-001',
      name: 'Dr. Sarah Chen, PT, DPT',
      credentials: 'Board Certified Neurologic Specialist (NCS)',
      specialty: 'Post-Stroke Motor Neuro-Rehabilitation',
    },
    riskAlert: null,
    prescription: {
      id: 'rx-001',
      patient_id: 'p-001',
      clinician_id: 'c-001',
      exercise_type: 'knee_extension',
      target_angle: 110,
      sets: 3,
      reps: 10,
      frequency_per_week: 5,
      notes: 'Focus on full terminal extension with a 2-second isometric pause. Keep back upright against chair.',
      created_at: '2026-08-25T10:00:00Z',
    },
    romHistory: [
      { session: 'S-1', date: 'Aug 24', romAngle: 82, targetAngle: 105, targetMet: false },
      { session: 'S-2', date: 'Aug 25', romAngle: 88, targetAngle: 105, targetMet: false },
      { session: 'S-3', date: 'Aug 26', romAngle: 94, targetAngle: 105, targetMet: false },
      { session: 'S-4', date: 'Aug 27', romAngle: 99, targetAngle: 110, targetMet: false },
      { session: 'S-5', date: 'Aug 28', romAngle: 106, targetAngle: 110, targetMet: true },
      { session: 'S-6', date: 'Aug 29', romAngle: 108, targetAngle: 110, targetMet: true },
      { session: 'S-7', date: 'Aug 30', romAngle: 114, targetAngle: 110, targetMet: true },
    ],
    sessionsHistory: [
      {
        id: 'sess-7',
        exerciseType: 'Knee Extension',
        date: 'Today, 9:30 AM',
        durationMinutes: 14,
        repsCompleted: 30,
        targetReps: 30,
        avgRom: 114,
        compensationFlags: ['Smooth trajectory', 'Stable posture'],
      },
      {
        id: 'sess-6',
        exerciseType: 'Knee Extension',
        date: 'Yesterday, 10:15 AM',
        durationMinutes: 16,
        repsCompleted: 28,
        targetReps: 30,
        avgRom: 108,
        compensationFlags: ['Mild quad tremor on rep 24'],
      },
      {
        id: 'sess-5',
        exerciseType: 'Knee Extension',
        date: 'Aug 28, 4:00 PM',
        durationMinutes: 18,
        repsCompleted: 27,
        targetReps: 30,
        avgRom: 106,
        compensationFlags: ['Pelvic tilt compensatory shift'],
      },
    ],
    angleDeviationData: [
      { repNumber: 1, measuredAngle: 108, prescribedAngle: 110, deviation: -2 },
      { repNumber: 2, measuredAngle: 110, prescribedAngle: 110, deviation: 0 },
      { repNumber: 3, measuredAngle: 112, prescribedAngle: 110, deviation: 2 },
      { repNumber: 4, measuredAngle: 115, prescribedAngle: 110, deviation: 5 },
      { repNumber: 5, measuredAngle: 109, prescribedAngle: 110, deviation: -1 },
      { repNumber: 6, measuredAngle: 114, prescribedAngle: 110, deviation: 4 },
      { repNumber: 7, measuredAngle: 113, prescribedAngle: 110, deviation: 3 },
      { repNumber: 8, measuredAngle: 111, prescribedAngle: 110, deviation: 1 },
      { repNumber: 9, measuredAngle: 116, prescribedAngle: 110, deviation: 6 },
      { repNumber: 10, measuredAngle: 114, prescribedAngle: 110, deviation: 4 },
    ],
  },
  {
    id: 'p-002',
    name: 'James Wilson',
    email: 'james.wilson@example.com',
    condition: 'Right Shoulder Impingement',
    conditionCategory: 'stroke',
    primaryInjury: 'stroke_shoulder',
    recoveryStage: 'Chronic (Month 4)',
    compliance: 64,
    assignedClinician: {
      id: 'c-001',
      name: 'Dr. Sarah Chen, PT, DPT',
      credentials: 'Board Certified Neurologic Specialist (NCS)',
      specialty: 'Post-Stroke Motor Neuro-Rehabilitation',
    },
    riskAlert: {
      type: 'warning',
      message: 'Compensatory trunk lateral lean >15° detected during shoulder flexion.',
      date: 'Aug 30',
    },
    prescription: {
      id: 'rx-002',
      patient_id: 'p-002',
      clinician_id: 'c-001',
      exercise_type: 'shoulder_raise',
      target_angle: 85,
      sets: 3,
      reps: 8,
      frequency_per_week: 4,
      notes: 'Avoid hiking the trapezius. Use mirror feedback to ensure scapular stability.',
      created_at: '2026-08-20T14:00:00Z',
    },
    romHistory: [
      { session: 'S-1', date: 'Aug 20', romAngle: 62, targetAngle: 85, targetMet: false },
      { session: 'S-2', date: 'Aug 22', romAngle: 66, targetAngle: 85, targetMet: false },
      { session: 'S-3', date: 'Aug 24', romAngle: 70, targetAngle: 85, targetMet: false },
      { session: 'S-4', date: 'Aug 26', romAngle: 72, targetAngle: 85, targetMet: false },
      { session: 'S-5', date: 'Aug 28', romAngle: 78, targetAngle: 85, targetMet: false },
      { session: 'S-6', date: 'Aug 29', romAngle: 81, targetAngle: 85, targetMet: false },
      { session: 'S-7', date: 'Aug 30', romAngle: 84, targetAngle: 85, targetMet: false },
    ],
    sessionsHistory: [
      {
        id: 'sess-201',
        exerciseType: 'Shoulder Raise',
        date: 'Yesterday, 3:15 PM',
        durationMinutes: 12,
        repsCompleted: 18,
        targetReps: 24,
        avgRom: 84,
        compensationFlags: ['Trunk lateral lean 18°', 'Trapezius elevation'],
      },
    ],
    angleDeviationData: [
      { repNumber: 1, measuredAngle: 76, prescribedAngle: 85, deviation: -9 },
      { repNumber: 2, measuredAngle: 80, prescribedAngle: 85, deviation: -5 },
      { repNumber: 3, measuredAngle: 82, prescribedAngle: 85, deviation: -3 },
      { repNumber: 4, measuredAngle: 84, prescribedAngle: 85, deviation: -1 },
      { repNumber: 5, measuredAngle: 79, prescribedAngle: 85, deviation: -6 },
    ],
  },
  {
    id: 'p-003',
    name: 'Maria Garcia',
    email: 'maria.garcia@example.com',
    condition: 'ACL Reconstruction (Right Knee)',
    conditionCategory: 'post_surgery',
    primaryInjury: 'post_surgery_knee',
    recoveryStage: 'Post-Op (Week 3)',
    compliance: 92,
    assignedClinician: {
      id: 'c-001',
      name: 'Dr. Sarah Chen, PT, DPT',
      credentials: 'Board Certified Neurologic Specialist (NCS)',
      specialty: 'Post-Stroke Motor Neuro-Rehabilitation',
    },
    riskAlert: {
      type: 'critical',
      message: 'Adherence dropped below 50% over past 4 days. Missed 2 scheduled sessions.',
      date: 'Aug 31',
    },
    prescription: {
      id: 'rx-003',
      patient_id: 'p-003',
      clinician_id: 'c-001',
      exercise_type: 'knee_extension',
      target_angle: 95,
      sets: 2,
      reps: 8,
      frequency_per_week: 6,
      notes: 'Perform seated in sturdy high-back chair. Rest 60s between sets.',
      created_at: '2026-08-28T09:00:00Z',
    },
    romHistory: [
      { session: 'S-1', date: 'Aug 25', romAngle: 68, targetAngle: 95, targetMet: false },
      { session: 'S-2', date: 'Aug 26', romAngle: 71, targetAngle: 95, targetMet: false },
      { session: 'S-3', date: 'Aug 27', romAngle: 75, targetAngle: 95, targetMet: false },
      { session: 'S-4', date: 'Aug 28', romAngle: 79, targetAngle: 95, targetMet: false },
    ],
    sessionsHistory: [
      {
        id: 'sess-301',
        exerciseType: 'Knee Extension',
        date: 'Aug 28, 11:00 AM',
        durationMinutes: 9,
        repsCompleted: 10,
        targetReps: 16,
        avgRom: 79,
        compensationFlags: ['Fatigue deceleration', 'Incomplete extension'],
      },
    ],
    angleDeviationData: [
      { repNumber: 1, measuredAngle: 75, prescribedAngle: 95, deviation: -20 },
      { repNumber: 2, measuredAngle: 78, prescribedAngle: 95, deviation: -17 },
      { repNumber: 3, measuredAngle: 79, prescribedAngle: 95, deviation: -16 },
    ],
  },
  {
    id: 'p-004',
    name: 'Grace Hopper-Kim',
    email: 'grace.kim@example.com',
    condition: 'Left Hemiplegia with Shoulder Subluxation Risk',
    recoveryStage: 'Subacute (Day 56)',
    compliance: 96,
    assignedClinician: {
      id: 'c-001',
      name: 'Dr. Sarah Chen, PT, DPT',
      credentials: 'Board Certified Neurologic Specialist (NCS)',
      specialty: 'Post-Stroke Motor Neuro-Rehabilitation',
    },
    riskAlert: null,
    prescription: {
      id: 'rx-004',
      patient_id: 'p-004',
      clinician_id: 'c-001',
      exercise_type: 'shoulder_raise',
      target_angle: 90,
      sets: 3,
      reps: 10,
      frequency_per_week: 5,
      notes: 'Support with active-assisted range as needed. Stop immediately if pain exceeds 3/10.',
      created_at: '2026-08-22T11:00:00Z',
    },
    romHistory: [
      { session: 'S-1', date: 'Aug 24', romAngle: 74, targetAngle: 90, targetMet: false },
      { session: 'S-2', date: 'Aug 25', romAngle: 79, targetAngle: 90, targetMet: false },
      { session: 'S-3', date: 'Aug 26', romAngle: 83, targetAngle: 90, targetMet: false },
      { session: 'S-4', date: 'Aug 27', romAngle: 88, targetAngle: 90, targetMet: false },
      { session: 'S-5', date: 'Aug 28', romAngle: 91, targetAngle: 90, targetMet: true },
      { session: 'S-6', date: 'Aug 29', romAngle: 92, targetAngle: 90, targetMet: true },
      { session: 'S-7', date: 'Aug 30', romAngle: 94, targetAngle: 90, targetMet: true },
    ],
    sessionsHistory: [
      {
        id: 'sess-401',
        exerciseType: 'Shoulder Raise',
        date: 'Today, 8:45 AM',
        durationMinutes: 15,
        repsCompleted: 30,
        targetReps: 30,
        avgRom: 94,
        compensationFlags: ['Stable scapula', 'Paced tempo'],
      },
    ],
    angleDeviationData: [
      { repNumber: 1, measuredAngle: 89, prescribedAngle: 90, deviation: -1 },
      { repNumber: 2, measuredAngle: 91, prescribedAngle: 90, deviation: +1 },
      { repNumber: 3, measuredAngle: 93, prescribedAngle: 90, deviation: +3 },
      { repNumber: 4, measuredAngle: 94, prescribedAngle: 90, deviation: +4 },
    ],
  },
];

const LOCAL_STORAGE_KEY = 'neuroflex_mock_patients_store';

export function getMockPatients(): MockPatientDetail[] {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    // fallback
  }
  return initialMockPatients;
}

export function saveMockPatients(patients: MockPatientDetail[]) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(patients));
}

export function updatePatientPrescription(
  patientId: string,
  updated: Partial<Prescription>
): MockPatientDetail[] {
  const current = getMockPatients();
  const index = current.findIndex(p => p.id === patientId);
  if (index !== -1) {
    current[index].prescription = {
      ...current[index].prescription,
      ...updated,
      created_at: new Date().toISOString(),
    };
    saveMockPatients(current);
  }
  return current;
}
