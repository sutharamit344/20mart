import { prisma, Prisma } from '@20mart/database';
import { AppError } from '../errors';
import { handlePaymentFailed, hashPayload, markPaymentCaptured } from '../orders';
import { markRefundFailed, markRefundProcessed } from '../admin-orders';
import { getPaymentProvider } from './index';

interface RazorpayEvent {
  event: string;
  payload?: {
    payment?: { entity?: { id: string; order_id: string | null; amount: number; status: string; error_description?: string | null } };
    refund?: { entity?: { id: string; payment_id: string; amount: number; status: string } };
  };
}

/**
 * Razorpay webhook. Authenticity comes only from the HMAC over the raw body.
 * Duplicate deliveries (same event id) are processed once; the underlying state
 * transitions are idempotent as well, so replays are harmless.
 */
export async function processRazorpayWebhook(rawBody: string, signature: string | null, eventIdHeader: string | null) {
  const provider = getPaymentProvider();
  if (!provider.verifyWebhookSignature(rawBody, signature)) throw new AppError(401, 'BAD_SIGNATURE', 'Invalid webhook signature');

  let evt: RazorpayEvent;
  try {
    evt = JSON.parse(rawBody) as RazorpayEvent;
  } catch {
    throw new AppError(400, 'BAD_PAYLOAD', 'Malformed webhook payload');
  }
  const payloadHash = hashPayload(rawBody);
  const eventId = (eventIdHeader && eventIdHeader.slice(0, 100)) || `hash:${payloadHash}`;
  if (await prisma.paymentEvent.findUnique({ where: { eventId } })) return { duplicate: true, handled: false };

  let handled = false;
  const pay = evt.payload?.payment?.entity;
  const ref = evt.payload?.refund?.entity;
  switch (evt.event) {
    case 'payment.captured':
    case 'order.paid':
      if (pay?.order_id && pay.status === 'captured') {
        await markPaymentCaptured(pay.order_id, pay.id, pay.amount).catch((e) => {
          if (e instanceof AppError && e.status === 404) return; // not one of our orders
          throw e;
        });
        handled = true;
      }
      break;
    case 'payment.failed':
      if (pay?.order_id) {
        await handlePaymentFailed(pay.order_id, pay.id, pay.error_description ?? 'Payment failed');
        handled = true;
      }
      break;
    case 'refund.processed':
      if (ref) handled = (await markRefundProcessed(ref.id)).applied;
      break;
    case 'refund.failed':
      if (ref) handled = (await markRefundFailed(ref.id, 'Provider reported refund failure')).applied;
      break;
    default:
      break; // acknowledged, not used
  }

  try {
    await prisma.paymentEvent.create({ data: { provider: 'RAZORPAY', eventId, type: evt.event.slice(0, 60), payloadHash } });
  } catch (e) {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
    return { duplicate: true, handled };
  }
  return { duplicate: false, handled };
}
