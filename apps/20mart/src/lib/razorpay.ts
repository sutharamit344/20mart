'use client';

import { storeApi } from './store';

export interface CheckoutPaymentParams {
  provider: 'RAZORPAY';
  keyId: string;
  providerOrderId: string;
  amountPaise: number;
  currency: 'INR';
  orderNumber: string;
  prefill: { name: string | null; email: string | null; contact: string | null };
}

type RazorpayCtor = new (opts: Record<string, unknown>) => { open: () => void; on: (evt: string, cb: (r: unknown) => void) => void };

let scriptPromise: Promise<void> | null = null;
function loadCheckoutScript() {
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error('Could not load the payment window. Check your connection and try again.'));
    };
    document.body.appendChild(s);
  });
  return scriptPromise;
}

/**
 * Opens Razorpay Checkout. The browser result is NOT trusted: it is sent to our server,
 * which verifies the signature and re-fetches the payment from Razorpay before confirming.
 */
export async function payWithRazorpay(params: CheckoutPaymentParams): Promise<'paid' | 'dismissed'> {
  await loadCheckoutScript();
  const Razorpay = (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay;
  if (!Razorpay) throw new Error('Payment window unavailable');
  return new Promise((resolve, reject) => {
    const rzp = new Razorpay({
      key: params.keyId,
      order_id: params.providerOrderId,
      amount: params.amountPaise,
      currency: params.currency,
      name: '20Mart',
      description: `Order ${params.orderNumber}`,
      prefill: { name: params.prefill.name ?? undefined, email: params.prefill.email ?? undefined, contact: params.prefill.contact ?? undefined },
      theme: { color: '#FF7A00' },
      handler: async (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        try {
          await storeApi('/api/payments/razorpay/verify', { body: resp });
          resolve('paid');
        } catch (e) {
          reject(e);
        }
      },
      modal: { ondismiss: () => resolve('dismissed') },
    });
    rzp.open();
  });
}
