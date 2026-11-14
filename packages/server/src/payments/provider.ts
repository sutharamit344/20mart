/**
 * Provider-independent payment boundary. Only provider references are stored —
 * never card numbers, CVV or other sensitive instrument data.
 */
export interface ProviderOrder {
  id: string;
  amountPaise: number;
  currency: 'INR';
}

export type ProviderPaymentStatus = 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';

export interface ProviderPayment {
  id: string;
  orderId: string | null;
  status: ProviderPaymentStatus;
  amountPaise: number;
  method?: string | null;
  errorDescription?: string | null;
}

export type ProviderRefundStatus = 'pending' | 'processed' | 'failed';

export interface ProviderRefund {
  id: string;
  paymentId: string;
  amountPaise: number;
  status: ProviderRefundStatus;
}

export interface PaymentProvider {
  readonly name: 'RAZORPAY';
  /** Public key id that the browser checkout needs. */
  readonly publicKey: string;
  createOrder(input: { amountPaise: number; receipt: string; notes?: Record<string, string> }): Promise<ProviderOrder>;
  fetchPayment(paymentId: string): Promise<ProviderPayment>;
  capturePayment(paymentId: string, amountPaise: number): Promise<ProviderPayment>;
  createRefund(input: { paymentId: string; amountPaise: number; notes?: Record<string, string> }): Promise<ProviderRefund>;
  fetchRefund(refundId: string): Promise<ProviderRefund>;
  /** Signature returned to the browser after checkout (order_id|payment_id). */
  verifyCheckoutSignature(input: { providerOrderId: string; providerPaymentId: string; signature: string }): boolean;
  /** Webhook signature over the exact raw request body. */
  verifyWebhookSignature(rawBody: string, signature: string | null): boolean;
}

export class PaymentProviderError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'PaymentProviderError';
  }
}
