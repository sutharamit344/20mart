import { createHmac, timingSafeEqual } from 'node:crypto';
import type { PaymentProvider, ProviderPayment, ProviderPaymentStatus, ProviderRefund, ProviderRefundStatus } from './provider';
import { PaymentProviderError } from './provider';

const API = 'https://api.razorpay.com/v1';

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

const hmacHex = (secret: string, data: string) => createHmac('sha256', secret).update(data).digest('hex');

function safeEqualHex(a: string, b: string) {
  if (!/^[0-9a-f]+$/i.test(a) || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

const paymentStatus = (s: string): ProviderPaymentStatus =>
  (['created', 'authorized', 'captured', 'refunded', 'failed'] as const).includes(s as ProviderPaymentStatus) ? (s as ProviderPaymentStatus) : 'failed';
const refundStatus = (s: string): ProviderRefundStatus => (s === 'processed' ? 'processed' : s === 'failed' ? 'failed' : 'pending');

type RzPayment = { id: string; order_id: string | null; status: string; amount: number; method?: string; error_description?: string | null };
type RzRefund = { id: string; payment_id: string; amount: number; status: string };

const mapPayment = (p: RzPayment): ProviderPayment => ({
  id: p.id,
  orderId: p.order_id,
  status: paymentStatus(p.status),
  amountPaise: p.amount,
  method: p.method ?? null,
  errorDescription: p.error_description ?? null,
});
const mapRefund = (r: RzRefund): ProviderRefund => ({ id: r.id, paymentId: r.payment_id, amountPaise: r.amount, status: refundStatus(r.status) });

/** Razorpay REST adapter (no SDK). Amounts are integer paise, which is Razorpay's native unit. */
export function createRazorpayProvider(cfg: RazorpayConfig): PaymentProvider {
  const doFetch = cfg.fetchImpl ?? fetch;
  const auth = 'Basic ' + Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString('base64');

  async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await doFetch(`${API}${path}`, {
        method,
        headers: { authorization: auth, ...(body ? { 'content-type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store',
      });
    } catch {
      throw new PaymentProviderError('Payment provider is unreachable');
    }
    const data = (await res.json().catch(() => null)) as (T & { error?: { description?: string } }) | null;
    if (!res.ok || !data) throw new PaymentProviderError(data?.error?.description ?? `Payment provider error (${res.status})`, res.status);
    return data;
  }

  return {
    name: 'RAZORPAY',
    publicKey: cfg.keyId,
    async createOrder({ amountPaise, receipt, notes }) {
      const o = await call<{ id: string; amount: number; currency: string }>('POST', '/orders', {
        amount: amountPaise,
        currency: 'INR',
        receipt: receipt.slice(0, 40),
        notes,
      });
      if (o.amount !== amountPaise) throw new PaymentProviderError('Provider order amount mismatch');
      return { id: o.id, amountPaise: o.amount, currency: 'INR' };
    },
    async fetchPayment(paymentId) {
      return mapPayment(await call<RzPayment>('GET', `/payments/${encodeURIComponent(paymentId)}`));
    },
    async capturePayment(paymentId, amountPaise) {
      return mapPayment(await call<RzPayment>('POST', `/payments/${encodeURIComponent(paymentId)}/capture`, { amount: amountPaise, currency: 'INR' }));
    },
    async createRefund({ paymentId, amountPaise, notes }) {
      return mapRefund(await call<RzRefund>('POST', `/payments/${encodeURIComponent(paymentId)}/refund`, { amount: amountPaise, notes }));
    },
    async fetchRefund(refundId) {
      return mapRefund(await call<RzRefund>('GET', `/refunds/${encodeURIComponent(refundId)}`));
    },
    verifyCheckoutSignature({ providerOrderId, providerPaymentId, signature }) {
      if (!providerOrderId || !providerPaymentId || !signature) return false;
      return safeEqualHex(signature, hmacHex(cfg.keySecret, `${providerOrderId}|${providerPaymentId}`));
    },
    verifyWebhookSignature(rawBody, signature) {
      if (!signature || !cfg.webhookSecret) return false;
      return safeEqualHex(signature, hmacHex(cfg.webhookSecret, rawBody));
    },
  };
}
