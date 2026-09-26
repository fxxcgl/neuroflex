import { fetchApi } from '../lib/api';

/**
 * Handle Doctor Onboarding via FastAPI backend
 */
export async function handlePaymentOnboard(reqBody: any) {
  try {
    const data = await fetchApi('/payments/onboard', {
      method: 'POST',
      body: JSON.stringify({
        doctorId: reqBody.doctorId,
        gateway: reqBody.gateway,
      }),
    });
    return { status: 200, body: { url: data.url } };
  } catch (error: any) {
    return { status: 400, body: { error: error.message || 'Payment onboard failed' } };
  }
}

/**
 * Handle Patient Checkout Subscription via FastAPI backend
 */
export async function handleSubscribe(reqBody: any) {
  try {
    const data = await fetchApi('/payments/subscribe', {
      method: 'POST',
      body: JSON.stringify({
        patientId: reqBody.patientId,
        doctorId: reqBody.doctorId,
        gateway: reqBody.gateway,
        amount: reqBody.amount,
      }),
    });
    return { status: 200, body: { url: data.url } };
  } catch (error: any) {
    return { status: 400, body: { error: error.message || 'Subscription failed' } };
  }
}

/**
 * Webhooks are now handled purely by the FastAPI backend on /payments/webhook
 */
export async function handleWebhook(gateway: string, payload: any) {
  return { status: 200, body: { success: true } };
}
