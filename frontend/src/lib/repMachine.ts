import type { ExerciseType } from '../types';

export type Point2D = {
  x: number;
  y: number;
};

export type RepPhase = 'REST' | 'ECCENTRIC' | 'PEAK_CONTRACTION' | 'CONCENTRIC';

export type ExerciseThresholds = {
  restAngle: number;
  peakAngle: number;
  tolerance: number;
  targetAngle: number;
  /** If true peak > rest (e.g. knee extension 90->170).
   *  If false peak < rest (e.g. heel slides 170->90). */
  peakIsHigher: boolean;
};

/** Build thresholds from raw values. */
export function makeThresholds(
  restAngle: number,
  peakAngle: number,
  targetAngle: number,
  tolerance: number,
  peakIsHigher: boolean,
): ExerciseThresholds {
  return { restAngle, peakAngle, targetAngle, tolerance, peakIsHigher };
}

/** Legacy thresholds for the two original exercises. */
export const EXERCISE_THRESHOLDS: Partial<Record<ExerciseType, ExerciseThresholds>> = {
  knee_extension: { restAngle: 90, peakAngle: 170, tolerance: 9, targetAngle: 170, peakIsHigher: true },
  shoulder_raise: { restAngle: 20, peakAngle: 160, tolerance: 9, targetAngle: 160, peakIsHigher: true },
};

export const PHASE_LABELS: Record<RepPhase, string> = {
  REST: 'Rest',
  ECCENTRIC: 'Eccentric',
  PEAK_CONTRACTION: 'Peak Contraction',
  CONCENTRIC: 'Concentric',
};

export type CompletedRepLog = {
  rep_number: number;
  peak_angle: number;
  min_angle: number;
  rom_range: number;
  target_met: boolean;
  timestamp: string;
};

export type SessionSummary = {
  totalReps: number;
  averagePeakAngle: number | null;
  repsMetTarget: number;
};

export type RepTrackerSnapshot = {
  phase: RepPhase;
  angle: number | null;
  repCount: number;
  cue: string | null;
  completed?: CompletedRepLog;
};

/**
 * Angle at vertex b formed by a-b-c using atan2. Returns degrees [0,180].
 */
export function calculateAngle(a: Point2D, b: Point2D, c: Point2D): number {
  const angle =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let degrees = Math.abs((angle * 180) / Math.PI);
  if (degrees > 180) degrees = 360 - degrees;
  return degrees;
}

export function createRepTracker() {
  let phase: RepPhase = 'REST';
  let repCount = 0;
  let minAngle = Number.POSITIVE_INFINITY;
  let maxAngle = Number.NEGATIVE_INFINITY;
  let smoothed: number | null = null;
  let previousSmoothed: number | null = null;
  let holdFrames = 0;
  let pendingPhase: RepPhase | null = null;
  let peakHoldFrames = 0;
  let reachedPeakThisRep = false;
  let missingFrames = 0;
  const logs: CompletedRepLog[] = [];

  const resetRepWindow = (angle: number) => { minAngle = angle; maxAngle = angle; };
  const noteAngle = (angle: number) => {
    minAngle = Math.min(minAngle, angle);
    maxAngle = Math.max(maxAngle, angle);
  };

  const requestPhase = (next: RepPhase): RepPhase => {
    if (pendingPhase !== next) { pendingPhase = next; holdFrames = 1; return phase; }
    holdFrames += 1;
    if (holdFrames >= 3) {
      phase = next; pendingPhase = null; holdFrames = 0;
      if (next === 'PEAK_CONTRACTION') peakHoldFrames = 0;
    }
    return phase;
  };

  const completeRep = (thresholds: ExerciseThresholds, timestamp: string): CompletedRepLog => {
    const { peakIsHigher, targetAngle, tolerance } = thresholds;
    const peak  = peakIsHigher ? (Number.isFinite(maxAngle) ? maxAngle : 0) : (Number.isFinite(minAngle) ? minAngle : 0);
    const other = peakIsHigher ? (Number.isFinite(minAngle) ? minAngle : 0) : (Number.isFinite(maxAngle) ? maxAngle : 0);
    const romRange = Math.abs(peak - other);
    const targetMet = peakIsHigher
      ? peak >= targetAngle - tolerance
      : peak <= targetAngle + tolerance;
    const log: CompletedRepLog = {
      rep_number: repCount + 1,
      peak_angle: round1(peak),
      min_angle:  round1(Math.min(peak, other)),
      rom_range:  round1(romRange),
      target_met: targetMet,
      timestamp,
    };
    repCount += 1; logs.push(log);
    console.info('[NeuroFlex rep]', log);
    return log;
  };

  const reset = () => {
    phase = 'REST'; repCount = 0;
    minAngle = Number.POSITIVE_INFINITY; maxAngle = Number.NEGATIVE_INFINITY;
    smoothed = null; previousSmoothed = null;
    holdFrames = 0; pendingPhase = null; peakHoldFrames = 0;
    reachedPeakThisRep = false; missingFrames = 0; logs.length = 0;
  };

  const update = (
    rawAngle: number | null,
    thresholds: ExerciseThresholds,
    timestamp: string,
  ): RepTrackerSnapshot => {
    if (rawAngle == null || Number.isNaN(rawAngle)) {
      missingFrames += 1;
      if (missingFrames > 20 && phase !== 'REST') {
        phase = 'REST'; pendingPhase = null; holdFrames = 0;
        reachedPeakThisRep = false; peakHoldFrames = 0;
      }
      return { phase, angle: smoothed, repCount, cue: null };
    }

    missingFrames = 0;
    if (smoothed != null && Math.abs(rawAngle - smoothed) > 35) {
      return { phase, angle: smoothed, repCount, cue: null };
    }
    previousSmoothed = smoothed;
    smoothed = smoothed == null ? rawAngle : smoothed * 0.55 + rawAngle * 0.45;

    const { restAngle, peakAngle, tolerance, targetAngle, peakIsHigher } = thresholds;

    // Threshold zones (direction-aware)
    const restExit  = peakIsHigher ? restAngle + tolerance : restAngle - tolerance;
    const peakEnter = peakIsHigher ? peakAngle - tolerance : peakAngle + tolerance;

    const inRestZone = peakIsHigher ? smoothed <= restExit  : smoothed >= restExit;
    const inPeakZone = peakIsHigher ? smoothed >= peakEnter : smoothed <= peakEnter;

    const increasing = previousSmoothed != null && smoothed > previousSmoothed + 1.0;
    const decreasing = previousSmoothed != null && smoothed < previousSmoothed - 1.0;

    const movingToPeak   = peakIsHigher ? increasing : decreasing;
    const movingFromPeak = peakIsHigher ? decreasing : increasing;

    // ROM excursion from rest
    const excursion = peakIsHigher
      ? maxAngle - Math.min(minAngle, restAngle)
      : Math.max(maxAngle, restAngle) - minAngle;
    const meaningfulRom = excursion >= 18;

    let completed: CompletedRepLog | undefined;
    let cue: string | null = null;

    if (phase === 'REST') {
      if (!inRestZone) {
        resetRepWindow(smoothed); reachedPeakThisRep = false; requestPhase('ECCENTRIC');
      } else {
        pendingPhase = null; holdFrames = 0; resetRepWindow(smoothed);
      }
    } else if (phase === 'ECCENTRIC') {
      noteAngle(smoothed);
      if (inPeakZone) {
        reachedPeakThisRep = true; requestPhase('PEAK_CONTRACTION');
      } else if (movingFromPeak && meaningfulRom && !inRestZone) {
        reachedPeakThisRep = true; requestPhase('PEAK_CONTRACTION');
      } else if (inRestZone && !reachedPeakThisRep) {
        requestPhase('REST');
      }
    } else if (phase === 'PEAK_CONTRACTION') {
      noteAngle(smoothed);
      peakHoldFrames += 1; reachedPeakThisRep = true;
      const currentPeak = peakIsHigher ? maxAngle : minAngle;
      const shortOfTarget = peakIsHigher
        ? currentPeak < targetAngle - tolerance
        : currentPeak > targetAngle + tolerance;
      if (shortOfTarget) cue = 'Try to reach a little further.';
      if (inRestZone || (peakHoldFrames >= 6 && !inPeakZone && movingFromPeak)) {
        requestPhase('CONCENTRIC');
      }
    } else if (phase === 'CONCENTRIC') {
      noteAngle(smoothed);
      if (inRestZone) {
        const confirmed = requestPhase('REST');
        if (confirmed === 'REST') {
          if (reachedPeakThisRep && meaningfulRom) completed = completeRep(thresholds, timestamp);
          reachedPeakThisRep = false; resetRepWindow(smoothed);
        }
      } else if (inPeakZone && movingToPeak) {
        requestPhase('PEAK_CONTRACTION');
      }
    }

    return { phase, angle: smoothed, repCount, cue, completed };
  };

  const getLogs = () => logs.slice();

  const summarize = (): SessionSummary => {
    if (logs.length === 0) return { totalReps: 0, averagePeakAngle: null, repsMetTarget: 0 };
    const peakSum = logs.reduce((sum, log) => sum + log.peak_angle, 0);
    return {
      totalReps: logs.length,
      averagePeakAngle: round1(peakSum / logs.length),
      repsMetTarget: logs.filter((log) => log.target_met).length,
    };
  };

  return { update, reset, getLogs, summarize };
}

export type RepTracker = ReturnType<typeof createRepTracker>;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
