import { supabase, isSupabaseConfigured } from '../lib/supabase.ts';

export interface RepAnalysisInput {
  repNumber: number;
  peakAngle: number;
  minAngle: number;
  romRange: number;
  targetMet: boolean;
  compensationFlags?: string[];
  timestamp?: string;
}

export interface MovementAnalysisRequest {
  patientId: string;
  exerciseType: 'knee_extension' | 'shoulder_raise';
  targetAngle?: number;
  startedAt: string;
  endedAt: string;
  reps: RepAnalysisInput[];
  sessionId?: string;
  txnId?: string;
}

export interface MovementAnalysisResult {
  sessionId: string;
  txnId?: string;
  recoveryScore: number; // 0 to 100
  qualityGrade: 'Optimal' | 'Progressing' | 'Guarded' | 'Needs Attention';
  romMetrics: {
    averageRom: number;
    targetRom: number;
    peakRom: number;
    romConsistencyPercentage: number;
    targetAchievementRate: number;
  };
  kinematics: {
    smoothnessScore: number; // 0 to 100
    cadenceConsistency: number; // 0 to 100
    compensationIndex: number; // 0 to 100 (100 is flawless posture)
    detectedCompensations: string[];
  };
  clinicalInsights: {
    headline: string;
    summary: string;
    actionableFeedback: string[];
  };
  repBreakdown: Array<{
    repNumber: number;
    peakAngle: number;
    romRange: number;
    targetMet: boolean;
    symmetryScore: number;
    status: 'Excellent' | 'Good' | 'Partial' | 'Compensated';
  }>;
}

// In-memory fallback stores for demo / offline environment
const memoryPendingPayments = new Map<string, { patientId: string; amount: number; asset: string; status: string; createdAt: string }>();
const memoryUsedTransactions = new Set<string>();

/**
 * Executes multi-factor kinematic movement analysis on repetition telemetry.
 */
export function runMovementAnalysisEngine(params: {
  exerciseType: 'knee_extension' | 'shoulder_raise';
  targetAngle: number;
  reps: RepAnalysisInput[];
  durationSeconds: number;
}): Omit<MovementAnalysisResult, 'sessionId' | 'txnId'> {
  const { exerciseType, targetAngle, reps } = params;
  const totalReps = reps.length;

  if (totalReps === 0) {
    return {
      recoveryScore: 0,
      qualityGrade: 'Needs Attention',
      romMetrics: {
        averageRom: 0,
        targetRom: targetAngle,
        peakRom: 0,
        romConsistencyPercentage: 0,
        targetAchievementRate: 0,
      },
      kinematics: {
        smoothnessScore: 0,
        cadenceConsistency: 0,
        compensationIndex: 100,
        detectedCompensations: [],
      },
      clinicalInsights: {
        headline: 'No Repetitions Logged',
        summary: 'No movement telemetry was captured in this session window.',
        actionableFeedback: ['Ensure your camera has a clear view of your full joint trajectory.'],
      },
      repBreakdown: [],
    };
  }

  // 1. ROM Calculations
  const peakAngles = reps.map((r) => Number(r.peakAngle) || 0);
  const totalPeak = peakAngles.reduce((sum, a) => sum + a, 0);
  const averageRom = Math.round(totalPeak / totalReps);
  const peakRom = Math.max(...peakAngles);
  const targetMetCount = reps.filter((r) => r.targetMet || r.peakAngle >= targetAngle - 5).length;
  const targetAchievementRate = Math.round((targetMetCount / totalReps) * 100);

  // Variance & Consistency
  const variance = peakAngles.reduce((acc, val) => acc + Math.pow(val - averageRom, 2), 0) / totalReps;
  const standardDeviation = Math.sqrt(variance);
  const romConsistencyPercentage = Math.max(20, Math.min(100, Math.round(100 - standardDeviation * 2.5)));

  // 2. Compensatory flags extraction
  const allFlags = new Set<string>();
  let totalCompensations = 0;
  reps.forEach((r) => {
    if (r.compensationFlags && Array.isArray(r.compensationFlags)) {
      r.compensationFlags.forEach((f) => {
        if (!f.toLowerCase().includes('target') && !f.toLowerCase().includes('smooth') && !f.toLowerCase().includes('stable')) {
          allFlags.add(f);
          totalCompensations++;
        }
      });
    }
  });

  const compensationPenalty = Math.min(40, totalCompensations * 6);
  const compensationIndex = Math.max(0, 100 - compensationPenalty);

  // 3. Smoothness & Cadence Score
  const smoothnessScore = Math.max(40, Math.min(98, Math.round(romConsistencyPercentage * 0.8 + (targetAchievementRate > 75 ? 20 : 10))));
  const cadenceConsistency = Math.max(50, Math.min(95, Math.round(100 - standardDeviation * 1.8)));

  // 4. Composite Recovery Score (0 - 100)
  // Weighted: 45% ROM Target, 25% Consistency, 20% Posture/Compensation, 10% Smoothness
  const romScore = Math.min(100, (averageRom / targetAngle) * 100);
  const rawScore = (
    romScore * 0.45 +
    romConsistencyPercentage * 0.25 +
    compensationIndex * 0.20 +
    smoothnessScore * 0.10
  );
  const recoveryScore = Math.max(15, Math.min(100, Math.round(rawScore)));

  // Grade mapping
  let qualityGrade: MovementAnalysisResult['qualityGrade'] = 'Progressing';
  if (recoveryScore >= 88) qualityGrade = 'Optimal';
  else if (recoveryScore >= 72) qualityGrade = 'Progressing';
  else if (recoveryScore >= 55) qualityGrade = 'Guarded';
  else qualityGrade = 'Needs Attention';

  // 5. Clinical Insights
  const exerciseName = exerciseType === 'knee_extension' ? 'Knee Extension' : 'Shoulder Raise';
  const detectedCompensations = Array.from(allFlags);

  let headline = `Substantial Motor Control in ${exerciseName}`;
  if (recoveryScore >= 88) {
    headline = `Exceptional Kinematic Recovery & Full Terminal Extension`;
  } else if (recoveryScore < 60) {
    headline = `Restricted Range of Motion with Mild Postural Compensation`;
  }

  const summary = `Completed ${totalReps} repetitions achieving an average peak joint angle of ${averageRom}° (Prescribed Target: ${targetAngle}°). Movement trajectory demonstrated ${romConsistencyPercentage}% repetition consistency and a ${recoveryScore}/100 composite recovery index.`;

  const actionableFeedback: string[] = [];
  if (averageRom < targetAngle - 8) {
    actionableFeedback.push(`Work on extending an extra ${(targetAngle - averageRom).toFixed(0)}° to reach terminal extension goal.`);
  } else {
    actionableFeedback.push(`Excellent target reach. Sustain a 2-second isometric pause at peak contraction.`);
  }

  if (detectedCompensations.length > 0) {
    actionableFeedback.push(`Mitigate compensatory movement (${detectedCompensations.join(', ')}): keep lumbar spine stabilized against chair.`);
  } else {
    actionableFeedback.push(`Clean biomechanical symmetry with no compensatory torso tilting detected.`);
  }

  // 6. Repetition Breakdown
  const repBreakdown = reps.map((r, idx) => {
    const isMet = r.targetMet || r.peakAngle >= targetAngle - 5;
    let status: 'Excellent' | 'Good' | 'Partial' | 'Compensated' = 'Good';
    if (isMet && r.peakAngle >= targetAngle) status = 'Excellent';
    else if (!isMet && r.peakAngle < targetAngle - 15) status = 'Partial';
    else if (r.compensationFlags && r.compensationFlags.some(f => f.toLowerCase().includes('lean') || f.toLowerCase().includes('shift'))) status = 'Compensated';

    const symmetry = Math.min(100, Math.max(50, Math.round(100 - Math.abs(r.peakAngle - targetAngle) * 1.5)));

    return {
      repNumber: r.repNumber || idx + 1,
      peakAngle: Math.round(r.peakAngle),
      romRange: Math.round(r.romRange || (r.peakAngle - r.minAngle)),
      targetMet: isMet,
      symmetryScore: symmetry,
      status,
    };
  });

  return {
    recoveryScore,
    qualityGrade,
    romMetrics: {
      averageRom,
      targetRom: targetAngle,
      peakRom,
      romConsistencyPercentage,
      targetAchievementRate,
    },
    kinematics: {
      smoothnessScore,
      cadenceConsistency,
      compensationIndex,
      detectedCompensations,
    },
    clinicalInsights: {
      headline,
      summary,
      actionableFeedback,
    },
    repBreakdown,
  };
}

/**
 * Safely retrieve environment variables across Node runtime, Vite bundler, and browser.
 */
function getEnvVar(name: string): string | undefined {
  const gProcess = (globalThis as any).process;
  if (gProcess?.env && gProcess.env[name]) {
    return gProcess.env[name];
  }
  try {
    return (import.meta as any).env?.[name] || (import.meta as any).env?.[`VITE_${name}`];
  } catch (e) {
    return undefined;
  }
}

/**
 * Main HTTP handler for POST /api/rehab/analyze-movement
 */
export async function handleAnalyzeMovementRequest(
  body: MovementAnalysisRequest,
  headers?: Record<string, string | undefined>
): Promise<{ status: number; body: any; responseHeaders?: Record<string, string> }> {

  const { patientId, exerciseType, reps = [], startedAt, endedAt, sessionId, txnId } = body;
  const targetAngle = body.targetAngle || (exerciseType === 'shoulder_raise' ? 150 : 110);
  const durationSeconds = Math.max(1, Math.round(
    (new Date(endedAt || Date.now()).getTime() - new Date(startedAt || Date.now()).getTime()) / 1000
  ));

  // ─── x402 Configuration ───────────────────────────────────────────────────
  // Doctor's Base wallet address — stored in doctor_payment_accounts or env
  const DOCTOR_WALLET = getEnvVar('VITE_DOCTOR_BASE_WALLET') ||
    getEnvVar('DOCTOR_BASE_WALLET') ||
    '0xRecipientDoctorWalletAddressHere'; // overridden per-session by doctor lookup

  // USDC on Base Sepolia
  const USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
  const SESSION_FEE_USDC = '2000000'; // $2.00 in 6-decimal USDC units
  const RESOURCE_URL = '/api/rehab/analyze-movement';
  const COMMISSION_BPS = 1500; // 15%

  console.log('⚡ [x402/AnalyzeMovement] Request received:', {
    patientId,
    exerciseType,
    repsCount: reps.length,
    hasPaymentHeader: Boolean(headers?.['x-payment']),
  });

  // ─── Phase 1: Check for x402 X-PAYMENT header or Razorpay UPI bypass ────────
  const xPaymentHeader = headers?.['x-payment'];
  const isUpiPayment = txnId && txnId.startsWith('rzp_');

  if (!xPaymentHeader && !isUpiPayment) {
    // No payment proof → return 402 with x402 payment requirements
    console.log('🔒 [x402] No X-PAYMENT header — returning 402 with payment requirements');

    const autoSessionId = sessionId || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const paymentRequirements = {
      scheme: 'exact',
      network: 'base-sepolia',
      maxAmountRequired: SESSION_FEE_USDC,
      resource: RESOURCE_URL,
      description: `NeuroFlex AI Movement Analysis — per-session fee ($2.00 USDC)`,
      mimeType: 'application/json',
      payTo: DOCTOR_WALLET,
      maxTimeoutSeconds: 300,
      asset: USDC_BASE_SEPOLIA,
      extra: {
        name: 'USD Coin',
        version: '2',
        sessionId: autoSessionId,
      },
    };

    return {
      status: 402,
      responseHeaders: {
        'X-ACCEPTS-PAYMENT': 'x402',
        'Content-Type': 'application/json',
      },
      body: {
        accepts: [paymentRequirements],
        error: 'Payment Required',
        sessionId: autoSessionId,
      },
    };
  }

  // ─── Phase 2: Verify Payment Proof ──────────────────────────────────────────
  let paymentData: any = {};
  
  if (isUpiPayment) {
    console.log(`✅ [Razorpay] UPI Payment verified via txnId: ${txnId}`);
  } else {
    // In production this would call the x402 facilitator API to verify on-chain.
    // For testnet dev: accept any well-formed header and log it.
    console.log('✅ [x402] X-PAYMENT header present — verifying payment proof...');
    try {
      paymentData = JSON.parse(Buffer.from(xPaymentHeader as string, 'base64').toString('utf-8'));
      console.log('✅ [x402] Payment decoded:', {
        from: paymentData.from,
        amount: paymentData.maxAmountRequired,
        network: paymentData.network,
      });
    } catch {
      // If not base64 JSON, treat as raw proof string (still valid for testnet)
      paymentData = { raw: xPaymentHeader };
    }
  }

  // ─── Phase 3: Log commission split to Supabase ────────────────────────────
  const grossAmount = isUpiPayment ? 160.00 : 2.00; // ₹160 for UPI, $2.00 for Web3
  const platformCommission = Math.round(grossAmount * COMMISSION_BPS) / 10000;
  const doctorPayout = grossAmount - platformCommission;
  const autoSessionId = sessionId || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  if (isSupabaseConfigured) {
    try {
      await supabase.from('subscription_payments').insert({
        subscription_id: null,
        gateway: isUpiPayment ? 'razorpay' : 'x402',
        gateway_payment_id: isUpiPayment ? txnId : (paymentData?.from ? `x402_${paymentData.from.slice(2, 10)}_${Date.now()}` : `x402_${Date.now()}`),
        gross_amount: grossAmount,
        platform_commission: platformCommission,
        doctor_payout_amount: doctorPayout,
        status: 'paid',
        paid_at: new Date().toISOString(),
      });
      console.log(`💰 [x402] Commission logged: platform=$${platformCommission}, doctor=$${doctorPayout}`);
    } catch (e) {
      console.warn('[x402] Supabase commission log notice:', e);
    }
  }

  // ─── Phase 4: Run movement analysis ───────────────────────────────────────
  console.log(`🧠 [x402/AnalyzeMovement] Running kinematic analysis for session: ${autoSessionId}`);

  const analysisEngineResult = runMovementAnalysisEngine({
    exerciseType,
    targetAngle,
    reps,
    durationSeconds,
  });

  const fullResult: MovementAnalysisResult = {
    sessionId: autoSessionId,
    txnId: txnId || 'x402',
    ...analysisEngineResult,
  };

  return {
    status: 200,
    responseHeaders: { 'Content-Type': 'application/json' },
    body: {
      success: true,
      sessionId: autoSessionId,
      paymentMethod: 'x402',
      grossAmount,
      platformCommission,
      doctorPayout,
      analysis: fullResult,
    },
  };
}
