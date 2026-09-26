/**
 * trajectoryTracker.ts
 * Mode B tracking logic:
 *   - ankle_circles: detect completed rotations via quadrant traversal
 *   - balance_hold:  measure hip/shoulder sway, score stability, time hold
 *   - gait_training: detect steps via ankle vertical oscillation, count & cadence
 */

import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

// -------------------------------------------------------------------
// Shared
// -------------------------------------------------------------------

export type TrajectorySnapshot = {
  /** Human-readable live feedback cue */
  cue: string | null;
  /** Count of completed events (rotations / holds / steps) */
  count: number;
  /** Mode-specific score (stability % for balance, symmetry % for gait) */
  score: number | null;
  /** Elapsed hold seconds (balance_hold mode only) */
  holdSeconds: number;
  /** Cadence steps/min (gait mode only) */
  cadence: number | null;
  /** True when a complete event was just registered this frame */
  eventThisFrame: boolean;
  /** Asymmetry flag (gait: left vs right step timing) */
  asymmetryFlag: boolean;
};

// -------------------------------------------------------------------
// Ankle Circles
// -------------------------------------------------------------------

type Quadrant = 0 | 1 | 2 | 3; // NE, SE, SW, NW (clockwise)

function getQuadrant(dx: number, dy: number): Quadrant {
  // dy in normalised coords is inverted (y=0 top, y=1 bottom)
  if (dx >= 0 && dy <= 0) return 0; // NE
  if (dx >= 0 && dy > 0)  return 1; // SE
  if (dx < 0  && dy > 0)  return 2; // SW
  return 3;                          // NW
}

export function createAnkleCircleTracker() {
  const HISTORY_LEN = 90; // ~3 seconds at 30fps
  const pathX: number[] = [];
  const pathY: number[] = [];
  let rotationCount = 0;
  let quadrantSequence: Quadrant[] = [];
  let lastQuadrant: Quadrant | null = null;

  const update = (
    footLandmark: NormalizedLandmark | null,
    ankleLandmark: NormalizedLandmark | null,
  ): TrajectorySnapshot => {
    let cue: string | null = null;
    let eventThisFrame = false;

    if (!footLandmark || !ankleLandmark ||
        (footLandmark.visibility ?? 0) < 0.3 ||
        (ankleLandmark.visibility ?? 0) < 0.3) {
      return { cue: 'Raise your foot so the camera can see it clearly.', count: rotationCount, score: null, holdSeconds: 0, cadence: null, eventThisFrame: false, asymmetryFlag: false };
    }

    const dx = footLandmark.x - ankleLandmark.x;
    const dy = footLandmark.y - ankleLandmark.y;
    pathX.push(dx);
    pathY.push(dy);
    if (pathX.length > HISTORY_LEN) { pathX.shift(); pathY.shift(); }

    const q = getQuadrant(dx, dy);

    if (lastQuadrant !== null && q !== lastQuadrant) {
      // Only add if it is the next quadrant in sequence
      const expected = ((quadrantSequence[quadrantSequence.length - 1] ?? q) + 1) % 4 as Quadrant;
      if (q === expected || quadrantSequence.length === 0) {
        quadrantSequence.push(q);
      } else {
        // Direction reversal — reset
        quadrantSequence = [q];
      }
    }
    lastQuadrant = q;

    // Detect a full rotation: all 4 quadrants in order
    if (quadrantSequence.length >= 4) {
      const last4 = quadrantSequence.slice(-4);
      const isFullRotation = last4[0] === 0 && last4[1] === 1 && last4[2] === 2 && last4[3] === 3
                          || last4[0] === 1 && last4[1] === 2 && last4[2] === 3 && last4[3] === 0
                          || last4[0] === 2 && last4[1] === 3 && last4[2] === 0 && last4[3] === 1
                          || last4[0] === 3 && last4[1] === 0 && last4[2] === 1 && last4[3] === 2;
      if (isFullRotation) {
        rotationCount += 1;
        eventThisFrame = true;
        quadrantSequence = [q]; // reset for next rotation
        cue = rotationCount % 5 === 0 ? `${rotationCount} circles! Keep going.` : `Circle ${rotationCount} complete.`;
      }
    }

    // Estimate circle radius (ROM quality)
    const r = Math.sqrt(dx * dx + dy * dy);
    if (r < 0.03) cue = 'Try to make bigger circles for better range of motion.';
    else if (!cue) cue = 'Keep drawing smooth, controlled circles.';

    return { cue, count: rotationCount, score: null, holdSeconds: 0, cadence: null, eventThisFrame, asymmetryFlag: false };
  };

  const reset = () => { pathX.length = 0; pathY.length = 0; rotationCount = 0; quadrantSequence = []; lastQuadrant = null; };

  return { update, reset };
}

// -------------------------------------------------------------------
// Balance Hold
// -------------------------------------------------------------------

export function createBalanceHoldTracker(targetHoldSeconds = 30, swayThreshold = 0.04) {
  const HISTORY_LEN = 90; // ~3 seconds
  const hipXHistory: number[] = [];
  const shoulderXHistory: number[] = [];
  let holdCount = 0;
  let holdStartTime: number | null = null;
  let totalHoldSeconds = 0;
  let lastScores: number[] = [];

  const update = (
    pose: NormalizedLandmark[],
    timestampMs: number,
  ): TrajectorySnapshot => {
    const leftHip  = pose[23];
    const rightHip = pose[24];
    const leftShoulder  = pose[11];
    const rightShoulder = pose[12];

    const hipVis = Math.min(leftHip?.visibility ?? 0, rightHip?.visibility ?? 0);
    const shoulderVis = Math.min(leftShoulder?.visibility ?? 0, rightShoulder?.visibility ?? 0);

    if (hipVis < 0.4 || shoulderVis < 0.4) {
      holdStartTime = null;
      return { cue: 'Stand fully in frame so hips and shoulders are visible.', count: holdCount, score: null, holdSeconds: 0, cadence: null, eventThisFrame: false, asymmetryFlag: false };
    }

    const hipMidX = (leftHip.x + rightHip.x) / 2;
    const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;

    hipXHistory.push(hipMidX);
    shoulderXHistory.push(shoulderMidX);
    if (hipXHistory.length > HISTORY_LEN) { hipXHistory.shift(); shoulderXHistory.shift(); }

    // Standard deviation of hip X = sway measure
    const hipSway = stddev(hipXHistory);
    const shoulderSway = stddev(shoulderXHistory);
    const totalSway = (hipSway + shoulderSway) / 2;

    // Stability score 0-100 (lower sway = higher score)
    const stabilityScore = Math.round(Math.max(0, 100 - (totalSway / swayThreshold) * 100));
    lastScores.push(stabilityScore);
    if (lastScores.length > HISTORY_LEN) lastScores.shift();

    const isStable = totalSway <= swayThreshold;
    let cue: string | null = null;
    let eventThisFrame = false;

    if (isStable) {
      if (holdStartTime === null) holdStartTime = timestampMs;
      totalHoldSeconds = (timestampMs - holdStartTime) / 1000;
      if (totalHoldSeconds >= targetHoldSeconds) {
        holdCount += 1;
        eventThisFrame = true;
        holdStartTime = null;
        totalHoldSeconds = 0;
        cue = `Hold ${holdCount} complete! Great balance.`;
      } else {
        const remaining = Math.ceil(targetHoldSeconds - totalHoldSeconds);
        cue = `Hold steady... ${remaining}s remaining`;
      }
    } else {
      holdStartTime = null;
      totalHoldSeconds = 0;
      cue = totalSway > swayThreshold * 2 ? 'Too much sway — steady yourself.' : 'Steady yourself to start the hold timer.';
    }

    const avgScore = lastScores.length > 0
      ? Math.round(lastScores.reduce((a, b) => a + b, 0) / lastScores.length)
      : stabilityScore;

    return {
      cue,
      count: holdCount,
      score: avgScore,
      holdSeconds: totalHoldSeconds,
      cadence: null,
      eventThisFrame,
      asymmetryFlag: false,
    };
  };

  const reset = () => { hipXHistory.length = 0; shoulderXHistory.length = 0; holdCount = 0; holdStartTime = null; totalHoldSeconds = 0; lastScores = []; };

  return { update, reset };
}

// -------------------------------------------------------------------
// Gait Training
// -------------------------------------------------------------------

export function createGaitTracker() {
  const VALLEY_THRESHOLD = 0.02;  // minimum oscillation depth to count as a step
  const LEFT_ANKLE  = 27;
  const RIGHT_ANKLE = 28;

  const leftYHistory: number[] = [];
  const rightYHistory: number[] = [];
  let stepCount = 0;
  let leftStepTimes: number[] = [];
  let rightStepTimes: number[] = [];
  let leftInStep = false;
  let rightInStep = false;
  let lastLeftPeak = 0;
  let lastRightPeak = 0;

  const update = (
    pose: NormalizedLandmark[],
    timestampMs: number,
  ): TrajectorySnapshot => {
    const leftAnkle  = pose[LEFT_ANKLE];
    const rightAnkle = pose[RIGHT_ANKLE];

    if (!leftAnkle || !rightAnkle ||
        (leftAnkle.visibility ?? 0) < 0.3 ||
        (rightAnkle.visibility ?? 0) < 0.3) {
      return { cue: 'Walk in front of the camera so both ankles are visible.', count: stepCount, score: null, holdSeconds: 0, cadence: null, eventThisFrame: false, asymmetryFlag: false };
    }

    const leftY  = leftAnkle.y;
    const rightY = rightAnkle.y;

    leftYHistory.push(leftY);
    rightYHistory.push(rightY);
    const WINDOW = 15;
    if (leftYHistory.length > WINDOW) { leftYHistory.shift(); rightYHistory.shift(); }

    // Detect when ankle rises (y decreases in norm coords) — this is a step
    // Step = peak rise followed by return (valley)
    const leftMin  = Math.min(...leftYHistory);
    const rightMin = Math.min(...rightYHistory);
    const leftMax  = Math.max(...leftYHistory);
    const rightMax = Math.max(...rightYHistory);

    let eventThisFrame = false;

    // Left step
    if (!leftInStep && leftMax - leftY > VALLEY_THRESHOLD) {
      leftInStep = true; lastLeftPeak = leftMin;
    } else if (leftInStep && leftY > lastLeftPeak + VALLEY_THRESHOLD) {
      leftInStep = false;
      stepCount += 1; eventThisFrame = true;
      leftStepTimes.push(timestampMs);
      if (leftStepTimes.length > 20) leftStepTimes.shift();
    }

    // Right step
    if (!rightInStep && rightMax - rightY > VALLEY_THRESHOLD) {
      rightInStep = true; lastRightPeak = rightMin;
    } else if (rightInStep && rightY > lastRightPeak + VALLEY_THRESHOLD) {
      rightInStep = false;
      stepCount += 1; eventThisFrame = true;
      rightStepTimes.push(timestampMs);
      if (rightStepTimes.length > 20) rightStepTimes.shift();
    }

    // Cadence (steps/min) from last 10 left steps
    let cadence: number | null = null;
    if (leftStepTimes.length >= 2) {
      const elapsed = (leftStepTimes[leftStepTimes.length - 1] - leftStepTimes[0]) / 1000;
      if (elapsed > 0) cadence = Math.round(((leftStepTimes.length - 1) / elapsed) * 60 * 2); // x2 for both legs
    }

    // Symmetry: compare average interval between left vs right steps
    let asymmetryFlag = false;
    if (leftStepTimes.length >= 3 && rightStepTimes.length >= 3) {
      const avgLeft  = intervalAvg(leftStepTimes);
      const avgRight = intervalAvg(rightStepTimes);
      const asymmetry = Math.abs(avgLeft - avgRight) / Math.max(avgLeft, avgRight);
      asymmetryFlag = asymmetry > 0.25; // >25% timing difference
    }

    let cue: string | null = null;
    if (asymmetryFlag) cue = 'Uneven stride detected — try to step more evenly on both sides.';
    else if (cadence && cadence > 0) cue = `${stepCount} steps · ${cadence} steps/min`;
    else cue = 'Walk naturally — the system is counting your steps.';

    return { cue, count: stepCount, score: asymmetryFlag ? 60 : 100, holdSeconds: 0, cadence, eventThisFrame, asymmetryFlag };
  };

  const reset = () => { leftYHistory.length = 0; rightYHistory.length = 0; stepCount = 0; leftStepTimes = []; rightStepTimes = []; leftInStep = false; rightInStep = false; };

  return { update, reset };
}

// -------------------------------------------------------------------
// Utilities
// -------------------------------------------------------------------

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((sum, v) => sum + (v - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

function intervalAvg(times: number[]): number {
  if (times.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < times.length; i++) sum += times[i] - times[i - 1];
  return sum / (times.length - 1);
}
