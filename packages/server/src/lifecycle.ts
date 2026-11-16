import { issueSignupCoupons } from './coupons';
import { notifyWelcome } from './notifications';
import { captureException } from './observability';

/** Runs once when a customer account is created (first Google sign-in). Never throws. */
export async function onCustomerSignup(userId: string, name: string | null) {
  try {
    await notifyWelcome(userId, name);
    await issueSignupCoupons(userId);
  } catch (e) {
    captureException(e, 'auth.signup_hooks_failed', { category: 'auth' });
  }
}
