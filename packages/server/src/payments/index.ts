import { env, razorpayConfigured } from '../env';
import { AppError } from '../errors';
import type { PaymentProvider } from './provider';
import { createRazorpayProvider } from './razorpay';

export * from './provider';
export { createRazorpayProvider } from './razorpay';

let override: PaymentProvider | null = null;

/** Test hook: inject a provider (e.g. Razorpay adapter with a mocked fetch). */
export function setPaymentProviderForTests(p: PaymentProvider | null) {
  override = p;
}

/** The configured online payment provider, or 503 when credentials are missing. */
export function getPaymentProvider(): PaymentProvider {
  if (override) return override;
  if (!razorpayConfigured()) throw new AppError(503, 'PAYMENTS_NOT_CONFIGURED', 'Online payment is not available right now');
  const e = env();
  return createRazorpayProvider({ keyId: e.RAZORPAY_KEY_ID, keySecret: e.RAZORPAY_KEY_SECRET, webhookSecret: e.RAZORPAY_WEBHOOK_SECRET });
}

export const onlinePaymentsAvailable = () => !!override || razorpayConfigured();
