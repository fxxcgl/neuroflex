import type { ExerciseType, TrackingMode } from '../types';

// ============================================================
// Landmark indices (MediaPipe Pose)
// ============================================================
export const POSE_IDX = {
  leftShoulder: 11, rightShoulder: 12,
  leftElbow: 13, rightElbow: 14,
  leftWrist: 15, rightWrist: 16,
  leftHip: 23, rightHip: 24,
  leftKnee: 25, rightKnee: 26,
  leftAnkle: 27, rightAnkle: 28,
  leftHeel: 29, rightHeel: 30,
  leftFootIndex: 31, rightFootIndex: 32,
} as const;

// ============================================================
// Angle-rep config
// peakIsHigher = true  → rest ~low, peak ~high (e.g. knee_extension 90→170)
// peakIsHigher = false → rest ~high, peak ~low  (e.g. heel_slides 170→90)
// ============================================================
export interface AngleRepConfig {
  /** Angle at rest position (degrees) */
  restAngle: number;
  /** Angle at full peak (degrees) */
  peakAngle: number;
  /** Acceptable margin around thresholds (degrees) */
  tolerance: number;
  /** Clinical target angle — rep is "met" if peak reaches this */
  targetAngle: number;
  /** If true, peak > rest; if false, peak < rest (e.g. heel slides) */
  peakIsHigher: boolean;
  /** Landmark triple for the primary angle measurement [a, b (vertex), c] */
  landmarks: {
    left: [number, number, number];
    right: [number, number, number];
  };
  /** Whether to also track the opposite leg and flag asymmetry */
  trackBothLegs?: boolean;
}

// ============================================================
// Timer/hold config (Mode C)
// ============================================================
export interface TimerHoldConfig {
  holdDurationSeconds: number;
  targetSets: number;
  /** If true, patient must tap confirm after each hold */
  requiresPatientConfirm: boolean;
}

// ============================================================
// Trajectory config (Mode B)
// ============================================================
export interface TrajectoryConfig {
  /** Which mode of tracking */
  subMode: 'ankle_circle' | 'balance_hold' | 'gait';
  /** Sway threshold for balance_hold (normalised units, ~0.04 = 4% of frame width) */
  swayThreshold?: number;
  /** Target hold duration in seconds for balance_hold */
  targetHoldSeconds?: number;
  /** Minimum step count for gait training */
  targetStepCount?: number;
}

// ============================================================
// Full exercise config record
// ============================================================
export interface ExerciseConfig {
  type: ExerciseType;
  trackingMode: TrackingMode;
  label: string;
  icon: string;
  focalJoint: string;
  clinicalLabel: string;
  description: string;
  defaultSets: number;
  defaultReps: number;
  /** Only present for angle_rep mode */
  angleRep?: AngleRepConfig;
  /** Only present for timer_hold mode */
  timerHold?: TimerHoldConfig;
  /** Only present for trajectory mode */
  trajectory?: TrajectoryConfig;
}

// ============================================================
// Central registry
// ============================================================
export const EXERCISE_CONFIGS: Record<ExerciseType, ExerciseConfig> = {

  // ----------------------------------------------------------
  // MODE A — Angle-based rep counting
  // ----------------------------------------------------------

  knee_extension: {
    type: 'knee_extension',
    trackingMode: 'angle_rep',
    label: 'Knee Extension',
    icon: '🦵',
    focalJoint: 'Knee',
    clinicalLabel: 'Knee Extension (Seated)',
    description: 'Rebuilds quadriceps activation and extensor strength. Lift your lower leg until the knee is as straight as possible, then lower slowly.',
    defaultSets: 3,
    defaultReps: 10,
    angleRep: {
      restAngle: 90, peakAngle: 170, tolerance: 9, targetAngle: 160,
      peakIsHigher: true,
      landmarks: {
        left:  [POSE_IDX.leftHip,  POSE_IDX.leftKnee,  POSE_IDX.leftAnkle],
        right: [POSE_IDX.rightHip, POSE_IDX.rightKnee, POSE_IDX.rightAnkle],
      },
    },
  },

  shoulder_raise: {
    type: 'shoulder_raise',
    trackingMode: 'angle_rep',
    label: 'Shoulder Raise',
    icon: '🦾',
    focalJoint: 'Shoulder',
    clinicalLabel: 'Shoulder Raise (Frontal)',
    description: 'Improves active overhead elevation and hemiparetic reach. Raise your arm forward and up as high as comfortable.',
    defaultSets: 3,
    defaultReps: 8,
    angleRep: {
      restAngle: 20, peakAngle: 160, tolerance: 9, targetAngle: 150,
      peakIsHigher: true,
      landmarks: {
        left:  [POSE_IDX.leftHip,  POSE_IDX.leftShoulder,  POSE_IDX.leftElbow],
        right: [POSE_IDX.rightHip, POSE_IDX.rightShoulder, POSE_IDX.rightElbow],
      },
    },
  },

  straight_leg_raise: {
    type: 'straight_leg_raise',
    trackingMode: 'angle_rep',
    label: 'Straight Leg Raise',
    icon: '🏋️',
    focalJoint: 'Hip',
    clinicalLabel: 'Straight Leg Raise',
    description: 'Strengthens hip flexors and quadriceps without stressing the knee. Lie flat and raise your straight leg to ~45°.',
    defaultSets: 3,
    defaultReps: 10,
    angleRep: {
      // Measured at the hip — shoulder-hip-knee angle
      // Rest: leg on floor ≈ 170-180°; peak: leg raised ≈ 45-90° (smaller value = more raised)
      // Because landmark order is shoulder→hip→knee, angle at hip decreases as leg rises
      restAngle: 170, peakAngle: 45, tolerance: 10, targetAngle: 45,
      peakIsHigher: false,
      landmarks: {
        left:  [POSE_IDX.leftShoulder,  POSE_IDX.leftHip,  POSE_IDX.leftKnee],
        right: [POSE_IDX.rightShoulder, POSE_IDX.rightHip, POSE_IDX.rightKnee],
      },
    },
  },

  heel_slides: {
    type: 'heel_slides',
    trackingMode: 'angle_rep',
    label: 'Heel Slides',
    icon: '🦶',
    focalJoint: 'Knee',
    clinicalLabel: 'Heel Slides (ROM)',
    description: 'Restores knee flexion ROM after surgery. Lie flat and slide your heel toward your buttocks, bending the knee as far as comfortable.',
    defaultSets: 3,
    defaultReps: 10,
    angleRep: {
      // hip-knee-ankle: extended leg ~170°; fully flexed ~90° (smaller = more bent)
      restAngle: 170, peakAngle: 90, tolerance: 10, targetAngle: 90,
      peakIsHigher: false,
      landmarks: {
        left:  [POSE_IDX.leftHip,  POSE_IDX.leftKnee,  POSE_IDX.leftAnkle],
        right: [POSE_IDX.rightHip, POSE_IDX.rightKnee, POSE_IDX.rightAnkle],
      },
    },
  },

  mini_squats: {
    type: 'mini_squats',
    trackingMode: 'angle_rep',
    label: 'Mini Squats',
    icon: '🏃',
    focalJoint: 'Knee',
    clinicalLabel: 'Mini Squats (Bilateral)',
    description: 'Gentle weight-bearing squat for knee strengthening. Stand and bend knees slightly (20–30°), then return to standing.',
    defaultSets: 3,
    defaultReps: 12,
    angleRep: {
      // hip-knee-ankle: standing ~170°; shallow squat ~130-140° (smaller = more bent)
      restAngle: 170, peakAngle: 130, tolerance: 10, targetAngle: 130,
      peakIsHigher: false,
      landmarks: {
        left:  [POSE_IDX.leftHip,  POSE_IDX.leftKnee,  POSE_IDX.leftAnkle],
        right: [POSE_IDX.rightHip, POSE_IDX.rightKnee, POSE_IDX.rightAnkle],
      },
      trackBothLegs: true,
    },
  },

  sit_to_stand: {
    type: 'sit_to_stand',
    trackingMode: 'angle_rep',
    label: 'Sit-to-Stand',
    icon: '🪑',
    focalJoint: 'Hip/Knee',
    clinicalLabel: 'Sit-to-Stand Cycles',
    description: 'Fundamental functional movement for daily independence. Rise from seated to fully standing and return in a controlled manner.',
    defaultSets: 3,
    defaultReps: 8,
    angleRep: {
      // hip-knee-ankle: seated ~90°; standing ~170° (larger = more extended = peak)
      restAngle: 90, peakAngle: 170, tolerance: 12, targetAngle: 165,
      peakIsHigher: true,
      landmarks: {
        left:  [POSE_IDX.leftHip,  POSE_IDX.leftKnee,  POSE_IDX.leftAnkle],
        right: [POSE_IDX.rightHip, POSE_IDX.rightKnee, POSE_IDX.rightAnkle],
      },
    },
  },

  calf_raises: {
    type: 'calf_raises',
    trackingMode: 'angle_rep',
    label: 'Calf Raises',
    icon: '⬆️',
    focalJoint: 'Ankle',
    clinicalLabel: 'Calf Raises (Plantarflexion)',
    description: 'Strengthens gastrocnemius and soleus. Rise up onto your tiptoes, hold briefly, and lower back down.',
    defaultSets: 3,
    defaultReps: 15,
    angleRep: {
      // knee-ankle-foot: neutral ≈ 90°; plantarflexed (raised) ≈ 120-130°
      restAngle: 90, peakAngle: 125, tolerance: 10, targetAngle: 120,
      peakIsHigher: true,
      landmarks: {
        left:  [POSE_IDX.leftKnee,  POSE_IDX.leftAnkle,  POSE_IDX.leftFootIndex],
        right: [POSE_IDX.rightKnee, POSE_IDX.rightAnkle, POSE_IDX.rightFootIndex],
      },
    },
  },

  ankle_pumps: {
    type: 'ankle_pumps',
    trackingMode: 'angle_rep',
    label: 'Ankle Pumps',
    icon: '🔄',
    focalJoint: 'Ankle',
    clinicalLabel: 'Ankle Pumps (Dorsi/Plantarflexion)',
    description: 'Improves ankle mobility and venous return. Alternately flex your foot up (dorsiflexion) and point it down (plantarflexion).',
    defaultSets: 3,
    defaultReps: 15,
    angleRep: {
      // knee-ankle-foot: dorsiflexion ~80° (foot up); plantarflexion ~120° (foot down)
      // Track the full pump cycle: rest=neutral 90°, peak=plantarflexion 120°
      restAngle: 90, peakAngle: 120, tolerance: 10, targetAngle: 115,
      peakIsHigher: true,
      landmarks: {
        left:  [POSE_IDX.leftKnee,  POSE_IDX.leftAnkle,  POSE_IDX.leftFootIndex],
        right: [POSE_IDX.rightKnee, POSE_IDX.rightAnkle, POSE_IDX.rightFootIndex],
      },
    },
  },

  // ----------------------------------------------------------
  // MODE B — Trajectory / Stability
  // ----------------------------------------------------------

  ankle_circles: {
    type: 'ankle_circles',
    trackingMode: 'trajectory',
    label: 'Ankle Circles',
    icon: '⭕',
    focalJoint: 'Ankle',
    clinicalLabel: 'Ankle Circles (ROM)',
    description: 'Restores ankle range of motion and proprioception. Draw large circles with your foot, clockwise then counter-clockwise.',
    defaultSets: 2,
    defaultReps: 10,
    trajectory: {
      subMode: 'ankle_circle',
    },
  },

  balance_hold: {
    type: 'balance_hold',
    trackingMode: 'trajectory',
    label: 'Balance Hold',
    icon: '⚖️',
    focalJoint: 'Core/Ankle',
    clinicalLabel: 'Single-Leg Balance Hold',
    description: 'Improves proprioception and ankle stability. Stand on one leg and hold steady for the target duration.',
    defaultSets: 3,
    defaultReps: 3,
    trajectory: {
      subMode: 'balance_hold',
      swayThreshold: 0.04,
      targetHoldSeconds: 30,
    },
  },

  gait_training: {
    type: 'gait_training',
    trackingMode: 'trajectory',
    label: 'Gait Training',
    icon: '🚶',
    focalJoint: 'Full Body',
    clinicalLabel: 'Gait Training (Step Analysis)',
    description: 'Trains symmetrical, coordinated walking. Walk back and forth in front of the camera; the system counts steps and detects asymmetry.',
    defaultSets: 1,
    defaultReps: 20,
    trajectory: {
      subMode: 'gait',
      targetStepCount: 20,
    },
  },

  // ----------------------------------------------------------
  // MODE C — Timer/Hold (self-reported)
  // ----------------------------------------------------------

  quad_sets: {
    type: 'quad_sets',
    trackingMode: 'timer_hold',
    label: 'Quad Sets',
    icon: '💪',
    focalJoint: 'Knee',
    clinicalLabel: 'Quad Sets (Isometric)',
    description: 'Isometric quadriceps activation with no joint movement — ideal early post-surgery. Tighten your thigh muscle as hard as you can and hold.',
    defaultSets: 3,
    defaultReps: 10,
    timerHold: {
      holdDurationSeconds: 10,
      targetSets: 3,
      requiresPatientConfirm: true,
    },
  },

  resistance_band: {
    type: 'resistance_band',
    trackingMode: 'timer_hold',
    label: 'Resistance Band',
    icon: '🎗️',
    focalJoint: 'Variable',
    clinicalLabel: 'Resistance Band Exercise',
    description: 'Strengthening with elastic resistance. The camera tracks your limb ROM; note which band color/resistance you used.',
    defaultSets: 3,
    defaultReps: 12,
    timerHold: {
      holdDurationSeconds: 0,  // no hold — free-form reps with patient note
      targetSets: 3,
      requiresPatientConfirm: false,
    },
  },

  muscle_activation: {
    type: 'muscle_activation',
    trackingMode: 'timer_hold',
    label: 'Muscle Activation',
    icon: '⚡',
    focalJoint: 'Variable',
    clinicalLabel: 'Muscle Activation (Isometric)',
    description: 'General isometric muscle activation to re-establish neuromuscular pathways. Squeeze and hold the target muscle group.',
    defaultSets: 3,
    defaultReps: 10,
    timerHold: {
      holdDurationSeconds: 10,
      targetSets: 3,
      requiresPatientConfirm: true,
    },
  },
};

export function getExerciseConfig(type: ExerciseType): ExerciseConfig {
  return EXERCISE_CONFIGS[type];
}

export function getTrackingMode(type: ExerciseType): TrackingMode {
  return EXERCISE_CONFIGS[type].trackingMode;
}

/** Returns true if this exercise uses the camera angle state machine */
export function isAngleRepExercise(type: ExerciseType): boolean {
  return EXERCISE_CONFIGS[type].trackingMode === 'angle_rep';
}

/** Returns true if this is a self-reported Mode C exercise */
export function isSelfReportedExercise(type: ExerciseType): boolean {
  return EXERCISE_CONFIGS[type].trackingMode === 'timer_hold';
}
