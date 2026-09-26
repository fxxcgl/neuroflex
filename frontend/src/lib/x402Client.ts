/**
 * x402 background payment client.
 *
 * Wraps the standard `fetch` API with @x402/fetch so that when the server
 * returns HTTP 402, the payment is automatically signed and the request
 * is retried — all invisible to the patient.
 *
 * Usage:
 *   import { x402Fetch } from './x402Client';
 *   const res = await x402Fetch('/api/rehab/analyze-movement', { method: 'POST', ... });
 */
import { wrapFetchWithPayment } from '@x402/fetch';
import type { PaymentRequirements } from '@x402/core';

// ─── Types ────────────────────────────────────────────────────────────────────

export type WalletSignFn = (payload: string) => Promise<string>;

// ─── Module-level wallet reference ────────────────────────────────────────────
// Set once when patient connects wallet. Cleared on disconnect.
let _walletAddress: string | null = null;
let _signPayment: WalletSignFn | null = null;

export function setX402Wallet(address: string, signFn: WalletSignFn) {
  _walletAddress = address;
  _signPayment = signFn;
  console.log(`✅ [x402] Wallet registered: ${address}`);
}

export function clearX402Wallet() {
  _walletAddress = null;
  _signPayment = null;
}

export function getX402WalletAddress(): string | null {
  return _walletAddress;
}

// ─── Payment signer ────────────────────────────────────────────────────────────
/**
 * Called by @x402/fetch when the server returns 402.
 * Signs the payment payload using the patient's connected wallet.
 */
async function paymentSigner(
  requirements: PaymentRequirements,
  _payload: unknown
): Promise<string> {
  if (!_walletAddress || !_signPayment) {
    throw new Error('No wallet connected. Please connect your wallet first.');
  }

  // Encode the payment requirements as a signable string
  const message = JSON.stringify({
    scheme: requirements.scheme,
    network: requirements.network,
    maxAmountRequired: requirements.maxAmountRequired,
    resource: requirements.resource,
    payTo: requirements.payTo,
    asset: requirements.asset,
    from: _walletAddress,
    nonce: Date.now(),
  });

  const signature = await _signPayment(message);
  return signature;
}

// ─── x402-enhanced fetch ────────────────────────────────────────────────────
export const x402Fetch = wrapFetchWithPayment(fetch, paymentSigner);
