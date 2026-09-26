import type { ConditionCategory, ExerciseType, PrimaryInjury } from '../types';

export interface InjuryConfig {
  id: PrimaryInjury;
  category: ConditionCategory;
  categoryLabel: string;
  subOptionLabel: string;
  badgeLabel: string;
  /** Primary exercise (first in the list) — used by legacy single-exercise flow */
  exerciseType: ExerciseType;
  /** All prescribed exercises for this injury — shown as a picker in the session page */
  prescribedExercises: ExerciseType[];
  clinicalLabel: string;
  defaultTargetAngle: number;
  defaultSets: number;
  defaultReps: number;
  focalJoint: string;
  icon: string;
  description: string;
}

export interface CategoryOption {
  id: ConditionCategory;
  title: string;
  shortDesc: string;
  icon: string;
  accent: string;
}

export const CATEGORY_OPTIONS: CategoryOption[] = [
  {
    id: 'stroke',
    title: 'Stroke Recovery',
    shortDesc: 'Neuromotor rehabilitation, hemiparesis recovery, and functional range of motion.',
    icon: 'brain',
    accent: 'border-blue-500 bg-blue-500/10 text-blue-400',
  },
  {
    id: 'orthopedic',
    title: 'Orthopedic Injury',
    shortDesc: 'Joint rehab, chronic inflammation, cartilage preservation, and pain management.',
    icon: 'bone',
    accent: 'border-amber-500 bg-amber-500/10 text-amber-400',
  },
  {
    id: 'sports_injury',
    title: 'Sports / Ankle Injury',
    shortDesc: 'Athletic sprains, ligament tears, neuromuscular re-education, and return to play.',
    icon: 'zap',
    accent: 'border-emerald-500 bg-emerald-500/10 text-emerald-400',
  },
  {
    id: 'post_surgery',
    title: 'Post-Surgery Recovery',
    shortDesc: 'Controlled post-operative mobilization, graft protection, and scar tissue prevention.',
    icon: 'stethoscope',
    accent: 'border-purple-500 bg-purple-500/10 text-purple-400',
  },
];

export const INJURY_CONFIGS: Record<PrimaryInjury, InjuryConfig> = {
  stroke_knee: {
    id: 'stroke_knee',
    category: 'stroke',
    categoryLabel: 'Stroke Recovery',
    subOptionLabel: 'Lower Limb (Knee)',
    badgeLabel: 'Stroke Recovery — Lower Limb (Knee)',
    exerciseType: 'knee_extension',
    prescribedExercises: ['knee_extension'],
    clinicalLabel: 'Stroke Rehabilitation — Knee Extension',
    defaultTargetAngle: 160,
    defaultSets: 3,
    defaultReps: 10,
    focalJoint: 'Knee',
    icon: 'leg',
    description: 'Rebuilds quadriceps activation, reduces extensor tone spasticity, and supports stable walking.',
  },
  stroke_shoulder: {
    id: 'stroke_shoulder',
    category: 'stroke',
    categoryLabel: 'Stroke Recovery',
    subOptionLabel: 'Upper Limb (Shoulder)',
    badgeLabel: 'Stroke Recovery — Upper Limb (Shoulder)',
    exerciseType: 'shoulder_raise',
    prescribedExercises: ['shoulder_raise'],
    clinicalLabel: 'Stroke Rehabilitation — Shoulder Raise',
    defaultTargetAngle: 150,
    defaultSets: 3,
    defaultReps: 8,
    focalJoint: 'Shoulder',
    icon: 'arm',
    description: 'Improves active overhead elevation, scapular upward rotation, and hemiparetic reach.',
  },
  ortho_knee_pain: {
    id: 'ortho_knee_pain',
    category: 'orthopedic',
    categoryLabel: 'Orthopedic Injury',
    subOptionLabel: 'Knee Pain',
    badgeLabel: 'Orthopedic — Knee Pain',
    exerciseType: 'quad_sets',
    prescribedExercises: ['quad_sets', 'straight_leg_raise', 'heel_slides', 'sit_to_stand', 'mini_squats'],
    clinicalLabel: 'Knee Pain Rehab — Multi-Exercise Protocol',
    defaultTargetAngle: 155,
    defaultSets: 3,
    defaultReps: 10,
    focalJoint: 'Knee',
    icon: 'leg',
    description: 'Progressive knee protocol: isometric activation, ROM restoration, and functional strengthening.',
  },
  ortho_ankle_injury: {
    id: 'ortho_ankle_injury',
    category: 'sports_injury',
    categoryLabel: 'Sports / Ankle Injury',
    subOptionLabel: 'Ankle Injury',
    badgeLabel: 'Ankle Injury — Rehab Protocol',
    exerciseType: 'ankle_pumps',
    prescribedExercises: ['ankle_pumps', 'ankle_circles', 'calf_raises', 'resistance_band', 'balance_hold'],
    clinicalLabel: 'Ankle Injury Rehab — Full Protocol',
    defaultTargetAngle: 50,
    defaultSets: 3,
    defaultReps: 12,
    focalJoint: 'Ankle',
    icon: 'foot',
    description: 'Restores talocrural ROM, proprioception, and tendon elasticity for smooth gait.',
  },
  sports_ankle_twist: {
    id: 'sports_ankle_twist',
    category: 'sports_injury',
    categoryLabel: 'Sports Injury',
    subOptionLabel: 'Ankle Twist',
    badgeLabel: 'Sports Injury — Ankle Twist',
    exerciseType: 'ankle_pumps',
    prescribedExercises: ['ankle_pumps', 'ankle_circles', 'calf_raises', 'resistance_band', 'balance_hold'],
    clinicalLabel: 'Sports Injury — Ankle Twist Rehab',
    defaultTargetAngle: 50,
    defaultSets: 3,
    defaultReps: 12,
    focalJoint: 'Ankle',
    icon: 'zap',
    description: 'Re-establishes ATFL ligament integrity, ankle proprioception, and dynamic landing stability.',
  },
  sports_leg_raise: {
    id: 'sports_leg_raise',
    category: 'sports_injury',
    categoryLabel: 'Sports Injury',
    subOptionLabel: 'Leg Raise / Hip',
    badgeLabel: 'Sports Injury — Leg Raise / Hip',
    exerciseType: 'straight_leg_raise',
    prescribedExercises: ['straight_leg_raise', 'mini_squats', 'balance_hold'],
    clinicalLabel: 'Hamstring & Hip — Leg Raise Protocol',
    defaultTargetAngle: 60,
    defaultSets: 3,
    defaultReps: 10,
    focalJoint: 'Hip',
    icon: 'run',
    description: 'Strengthens eccentric hamstring control and hip flexor drive to avoid strain recurrence.',
  },
  post_surgery_knee: {
    id: 'post_surgery_knee',
    category: 'post_surgery',
    categoryLabel: 'Post-Surgery Recovery',
    subOptionLabel: 'Knee (ACL/Meniscus)',
    badgeLabel: 'Post-Surgery — Knee (ACL/Meniscus)',
    exerciseType: 'heel_slides',
    prescribedExercises: ['heel_slides', 'muscle_activation', 'straight_leg_raise', 'mini_squats', 'gait_training'],
    clinicalLabel: 'Post-Surgical Knee — Progressive Protocol',
    defaultTargetAngle: 90,
    defaultSets: 3,
    defaultReps: 8,
    focalJoint: 'Knee',
    icon: 'stethoscope',
    description: 'Safe progressive protocol: early ROM via heel slides, muscle re-activation, gradual strengthening, and gait recovery.',
  },
};

export function getSubOptionsForCategory(category: ConditionCategory): InjuryConfig[] {
  return Object.values(INJURY_CONFIGS).filter((c) => c.category === category);
}

export function getInjuryConfig(id: PrimaryInjury | string | null | undefined): InjuryConfig {
  if (id && id in INJURY_CONFIGS) {
    return INJURY_CONFIGS[id as PrimaryInjury];
  }
  return INJURY_CONFIGS.stroke_knee;
}

/** Returns the prescribed exercise list for a given injury ID. */
export function getPrescribedExercises(injury: PrimaryInjury | string | null | undefined): ExerciseType[] {
  return getInjuryConfig(injury).prescribedExercises;
}
