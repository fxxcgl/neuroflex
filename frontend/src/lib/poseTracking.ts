import {
  FilesetResolver,
  PoseLandmarker,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';
import type { ExerciseType } from '../types';
import { calculateAngle } from './repMachine';

/** Must match the installed `@mediapipe/tasks-vision` package version. */
const TASKS_VISION_VERSION = '1.0.1';

const WASM_CANDIDATES = [
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`,
  `https://unpkg.com/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`,
];

/** Lite / fast pose model — inference runs in-browser via WASM, not on a server. */
export const POSE_LITE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export const POSE = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
} as const;

export type KeyLandmarkId =
  | 'L Shoulder'
  | 'R Shoulder'
  | 'L Elbow'
  | 'R Elbow'
  | 'L Hip'
  | 'R Hip'
  | 'L Knee'
  | 'R Knee'
  | 'L Ankle'
  | 'R Ankle';

export const KEY_LANDMARKS: { id: KeyLandmarkId; index: number }[] = [
  { id: 'L Shoulder', index: POSE.leftShoulder },
  { id: 'R Shoulder', index: POSE.rightShoulder },
  { id: 'L Elbow', index: POSE.leftElbow },
  { id: 'R Elbow', index: POSE.rightElbow },
  { id: 'L Hip', index: POSE.leftHip },
  { id: 'R Hip', index: POSE.rightHip },
  { id: 'L Knee', index: POSE.leftKnee },
  { id: 'R Knee', index: POSE.rightKnee },
  { id: 'L Ankle', index: POSE.leftAnkle },
  { id: 'R Ankle', index: POSE.rightAnkle },
];

/** Minimum skeleton: shoulders, elbows, hips, knees, ankles (+ wrists for arm tracking). */
export const SKELETON_CONNECTIONS: [number, number][] = [
  [POSE.leftShoulder, POSE.rightShoulder],
  [POSE.leftShoulder, POSE.leftElbow],
  [POSE.leftElbow, POSE.leftWrist],
  [POSE.rightShoulder, POSE.rightElbow],
  [POSE.rightElbow, POSE.rightWrist],
  [POSE.leftShoulder, POSE.leftHip],
  [POSE.rightShoulder, POSE.rightHip],
  [POSE.leftHip, POSE.rightHip],
  [POSE.leftHip, POSE.leftKnee],
  [POSE.leftKnee, POSE.leftAnkle],
  [POSE.rightHip, POSE.rightKnee],
  [POSE.rightKnee, POSE.rightAnkle],
];

export type LandmarkVisibility = {
  id: KeyLandmarkId;
  visibility: number;
};

export type TrackingSnapshot = {
  poseDetected: boolean;
  averageVisibility: number;
  landmarks: LandmarkVisibility[];
};

export type AngleMeasurement = {
  angle: number;
  side: 'left' | 'right';
  visibility: number;
};

const ANGLE_VISIBILITY_MIN = 0.15;
const HIP_ASYMMETRY_Y = 0.07;

const VISIBILITY_DRAW_MIN = 0.25;

export function parseExerciseParam(value: string | null): ExerciseType {
  return value === 'shoulder_raise' ? 'shoulder_raise' : 'knee_extension';
}

export function createEmptySnapshot(): TrackingSnapshot {
  return {
    poseDetected: false,
    averageVisibility: 0,
    landmarks: KEY_LANDMARKS.map(({ id }) => ({ id, visibility: 0 })),
  };
}

export function measureExerciseAngle(
  pose: NormalizedLandmark[] | undefined,
  exerciseType: ExerciseType,
  preferredSide?: 'left' | 'right' | null,
): AngleMeasurement | null {
  if (!pose || pose.length === 0) return null;

  const left =
    exerciseType === 'knee_extension'
      ? triple(pose, POSE.leftHip, POSE.leftKnee, POSE.leftAnkle)
      : shoulderRaiseTriple(pose, 'left');
  const right =
    exerciseType === 'knee_extension'
      ? triple(pose, POSE.rightHip, POSE.rightKnee, POSE.rightAnkle)
      : shoulderRaiseTriple(pose, 'right');

  const leftVis = minVisibility(left);
  const rightVis = minVisibility(right);
  let side: 'left' | 'right' = leftVis >= rightVis ? 'left' : 'right';
  if (preferredSide) {
    const preferredVis = preferredSide === 'left' ? leftVis : rightVis;
    const otherVis = preferredSide === 'left' ? rightVis : leftVis;
    if (preferredVis >= ANGLE_VISIBILITY_MIN || preferredVis + 0.12 >= otherVis) {
      side = preferredSide;
    }
  }
  const chosen = side === 'left' ? left : right;
  const visibility = side === 'left' ? leftVis : rightVis;

  if (!chosen || visibility < ANGLE_VISIBILITY_MIN) return null;

  return {
    angle: calculateAngle(chosen[0], chosen[1], chosen[2]),
    side,
    visibility,
  };
}

export function hasHipVerticalAsymmetry(pose: NormalizedLandmark[] | undefined): boolean {
  if (!pose) return false;
  const leftHip = pose[POSE.leftHip];
  const rightHip = pose[POSE.rightHip];
  if (!leftHip || !rightHip) return false;
  if (Math.min(leftHip.visibility ?? 0, rightHip.visibility ?? 0) < 0.45) return false;
  return Math.abs(leftHip.y - rightHip.y) >= HIP_ASYMMETRY_Y;
}

function shoulderRaiseTriple(
  pose: NormalizedLandmark[],
  side: 'left' | 'right',
): [NormalizedLandmark, NormalizedLandmark, NormalizedLandmark] | null {
  const hipIndex = side === 'left' ? POSE.leftHip : POSE.rightHip;
  const shoulderIndex = side === 'left' ? POSE.leftShoulder : POSE.rightShoulder;
  const elbowIndex = side === 'left' ? POSE.leftElbow : POSE.rightElbow;
  const hip = pose[hipIndex];
  const shoulder = pose[shoulderIndex];
  const elbow = pose[elbowIndex];
  if (!shoulder || !elbow) return null;
  if ((shoulder.visibility ?? 0) < 0.4 || (elbow.visibility ?? 0) < 0.1) return null;
  const armLength = Math.hypot(elbow.x - shoulder.x, elbow.y - shoulder.y);
  if (armLength < 0.06) return null;

  const hipPoint: NormalizedLandmark =
    hip && (hip.visibility ?? 0) >= 0.4
      ? hip
      : {
          x: shoulder.x,
          y: Math.min(1, shoulder.y + 0.5),
          z: shoulder.z,
          visibility: shoulder.visibility,
        };

  return [hipPoint, shoulder, elbow];
}

function triple(
  pose: NormalizedLandmark[],
  a: number,
  b: number,
  c: number,
): [NormalizedLandmark, NormalizedLandmark, NormalizedLandmark] | null {
  const pa = pose[a];
  const pb = pose[b];
  const pc = pose[c];
  if (!pa || !pb || !pc) return null;
  return [pa, pb, pc];
}

function minVisibility(
  points: [NormalizedLandmark, NormalizedLandmark, NormalizedLandmark] | null,
): number {
  if (!points) return 0;
  return Math.min(points[0].visibility ?? 0, points[1].visibility ?? 0, points[2].visibility ?? 0);
}

export function snapshotFromLandmarks(pose: NormalizedLandmark[] | undefined): TrackingSnapshot {
  if (!pose || pose.length === 0) {
    return createEmptySnapshot();
  }

  const landmarks = KEY_LANDMARKS.map(({ id, index }) => ({
    id,
    visibility: clamp01(pose[index]?.visibility ?? 0),
  }));

  const averageVisibility =
    landmarks.reduce((sum, item) => sum + item.visibility, 0) / landmarks.length;

  return {
    poseDetected: averageVisibility >= 0.35,
    averageVisibility,
    landmarks,
  };
}

export { calculateAngle } from './repMachine';

export async function createLitePoseLandmarker(): Promise<PoseLandmarker> {
  let lastError: unknown;

  for (const wasmPath of WASM_CANDIDATES) {
    try {
      const vision = await FilesetResolver.forVisionTasks(wasmPath);
      try {
        return await PoseLandmarker.createFromOptions(vision, poseOptions('GPU'));
      } catch {
        return await PoseLandmarker.createFromOptions(vision, poseOptions('CPU'));
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Could not load MediaPipe Pose Landmarker.');
}

function poseOptions(delegate: 'GPU' | 'CPU') {
  return {
    baseOptions: {
      modelAssetPath: POSE_LITE_MODEL_URL,
      delegate,
    },
    runningMode: 'VIDEO' as const,
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  };
}

export function drawPoseOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pose: NormalizedLandmark[] | undefined,
  exerciseType: ExerciseType,
): void {
  ctx.clearRect(0, 0, width, height);
  if (!pose || pose.length === 0) return;

  const highlight = new Set<number>(
    exerciseType === 'knee_extension'
      ? [POSE.leftHip, POSE.rightHip, POSE.leftKnee, POSE.rightKnee, POSE.leftAnkle, POSE.rightAnkle]
      : [POSE.leftShoulder, POSE.rightShoulder, POSE.leftElbow, POSE.rightElbow, POSE.leftWrist, POSE.rightWrist],
  );

  for (const [startIndex, endIndex] of SKELETON_CONNECTIONS) {
    const start = pose[startIndex];
    const end = pose[endIndex];
    if (!start || !end) continue;

    const visibility = Math.min(start.visibility ?? 0, end.visibility ?? 0);
    if (visibility < VISIBILITY_DRAW_MIN) continue;

    const emphasized = highlight.has(startIndex) && highlight.has(endIndex);
    ctx.beginPath();
    ctx.moveTo(start.x * width, start.y * height);
    ctx.lineTo(end.x * width, end.y * height);
    ctx.strokeStyle = boneColor(visibility, emphasized);
    ctx.lineWidth = emphasized ? 6 : 4;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  const jointIndexes = new Set<number>();
  for (const [a, b] of SKELETON_CONNECTIONS) {
    jointIndexes.add(a);
    jointIndexes.add(b);
  }

  for (const index of jointIndexes) {
    const point = pose[index];
    if (!point) continue;
    const visibility = point.visibility ?? 0;
    if (visibility < VISIBILITY_DRAW_MIN) continue;

    const radius = highlight.has(index) ? 8 : 6;
    ctx.beginPath();
    ctx.arc(point.x * width, point.y * height, radius, 0, Math.PI * 2);
    ctx.fillStyle = jointFill(visibility);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.stroke();
  }
}

function boneColor(visibility: number, emphasized: boolean): string {
  const alpha = emphasized ? 0.95 : 0.75;
  if (visibility >= 0.7) return `rgba(45, 212, 191, ${alpha})`;
  if (visibility >= 0.45) return `rgba(251, 191, 36, ${alpha})`;
  return `rgba(248, 113, 113, ${alpha})`;
}

function jointFill(visibility: number): string {
  if (visibility >= 0.7) return '#5eead4';
  if (visibility >= 0.45) return '#fbbf24';
  return '#f87171';
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
