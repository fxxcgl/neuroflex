export type UserRole = 'patient' | 'clinician';

export type ExerciseType =
  // Mode A — Angle-based rep counting
  | 'knee_extension'
  | 'shoulder_raise'
  | 'straight_leg_raise'
  | 'heel_slides'
  | 'mini_squats'
  | 'sit_to_stand'
  | 'calf_raises'
  | 'ankle_pumps'
  // Mode B — Trajectory / stability tracking
  | 'ankle_circles'
  | 'balance_hold'
  | 'gait_training'
  // Mode C — Timer/hold (self-reported)
  | 'quad_sets'
  | 'resistance_band'
  | 'muscle_activation';

/** Determines how a session of this exercise is tracked and recorded. */
export type TrackingMode = 'angle_rep' | 'trajectory' | 'timer_hold';

export type ConditionCategory = 'stroke' | 'orthopedic' | 'sports_injury' | 'post_surgery';

export type PrimaryInjury =
  | 'stroke_knee'
  | 'stroke_shoulder'
  | 'ortho_knee_pain'
  | 'ortho_ankle_injury'
  | 'sports_ankle_twist'
  | 'sports_leg_raise'
  | 'post_surgery_knee';

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export interface UserProfile {
  id: string;
  role: UserRole;
  full_name?: string | null;
  email?: string;
  phone?: string | null;
  created_at?: string;
}

export interface PatientProfile {
  user_id: string;
  date_of_birth?: string | null;
  condition?: string | null;
  condition_category?: ConditionCategory | null;
  primary_injury?: PrimaryInjury | null;
  assigned_clinician_id?: string | null;
}

export interface ClinicianProfile {
  user_id: string;
  credentials?: string | null;
  specialty?: string | null;
}

export interface Prescription {
  id: string;
  patient_id: string;
  clinician_id: string;
  exercise_type: ExerciseType;
  target_angle: number;
  sets: number;
  reps: number;
  frequency_per_week: number;
  notes?: string | null;
  created_at: string;
}

export interface Session {
  id: string;
  patient_id: string;
  prescription_id?: string | null;
  exercise_type: string;
  started_at: string;
  ended_at?: string | null;
}

export interface SessionRep {
  id: string;
  session_id: string;
  rep_number: number;
  // Mode A fields (nullable — not applicable to Mode B/C)
  peak_angle?: number | null;
  min_angle?: number | null;
  rom_range?: number | null;
  target_met: boolean;
  compensation_flags?: string[];
  // Mode B — trajectory / stability
  hold_duration_seconds?: number | null;
  stability_score?: number | null;
  rotation_count?: number | null;
  // Mode C — timer/hold self-report
  self_reported?: boolean;
  created_at: string;
}

export interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
}

export interface Appointment {
  id: string;
  patient_id: string;
  clinician_id: string;
  scheduled_at: string;
  status: AppointmentStatus;
}

export interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  loading: boolean;
  isDemoMode: boolean;
  isSupabaseConfigured: boolean;
  signIn: (email: string, password: string, role?: UserRole) => Promise<{ error: string | null; needsEmailVerification?: boolean }>;
  signUp: (
    email: string,
    password: string,
    role: UserRole,
    fullName?: string,
    assignedClinicianId?: string
  ) => Promise<{ error: string | null; needsEmailVerification?: boolean }>;
  signOut: () => Promise<void>;
  switchDemoUser: (role: UserRole) => void;
  confirmDemoVerification?: (email?: string) => Promise<boolean>;
}

export type GatewayType = 'razorpay' | 'stripe' | 'paypal';

export interface DoctorPaymentAccount {
  id: string;
  doctor_id: string;
  gateway: GatewayType;
  connected_account_id: string;
  status: 'pending_kyc' | 'active';
  created_at: string;
}

export interface Subscription {
  id: string;
  patient_id: string;
  doctor_id: string;
  gateway: GatewayType;
  gateway_subscription_id: string;
  amount: number;
  commission_percent: number;
  status: string;
  current_period_end?: string;
  created_at: string;
}

export interface SubscriptionPayment {
  id: string;
  subscription_id: string;
  gateway: GatewayType;
  gateway_payment_id: string;
  gross_amount: number;
  platform_commission: number;
  doctor_payout_amount: number;
  status: string;
  paid_at: string;
}
