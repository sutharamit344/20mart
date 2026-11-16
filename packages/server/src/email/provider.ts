import { createHmac, timingSafeEqual } from 'node:crypto';
import { emailConfigured, env } from '../env';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  /** Idempotency key so a retried send is not delivered twice by the provider. */
  idempotencyKey: string;
}

export interface EmailProvider {
  readonly name: string;
  /** Resolves with the provider's message id once the provider ACCEPTED the message. */
  send(input: SendEmailInput): Promise<{ id: string }>;
}

export class EmailProviderError extends Error {
  constructor(message: string, public readonly retryable: boolean) {
    super(message);
    this.name = 'EmailProviderError';
  }
}

/** Resend REST adapter (no SDK). fetchImpl is injectable for tests. */
export function createResendProvider(opts: { apiKey: string; from: string; fetchImpl?: typeof fetch }): EmailProvider {
  const doFetch = opts.fetchImpl ?? fetch;
  return {
    name: 'RESEND',
    async send(input) {
      let res: Response;
      try {
        res = await doFetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${opts.apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': input.idempotencyKey },
          body: JSON.stringify({ from: opts.from, to: [input.to], subject: input.subject, html: input.html }),
          signal: AbortSignal.timeout(8000),
        });
      } catch (e) {
        throw new EmailProviderError(`Network error: ${(e as Error).message}`, true);
      }
      const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
      if (!res.ok || !body.id) {
        throw new EmailProviderError(body.message ?? `Resend responded ${res.status}`, res.status >= 500 || res.status === 429);
      }
      return { id: body.id };
    },
  };
}

let override: EmailProvider | null = null;
export function setEmailProviderForTests(p: EmailProvider | null) {
  override = p;
}

/** Configured provider, or null when email is not set up (messages are then marked SKIPPED, never "sent"). */
export function getEmailProvider(): EmailProvider | null {
  if (override) return override;
  if (!emailConfigured()) return null;
  return createResendProvider({ apiKey: env().RESEND_API_KEY, from: env().EMAIL_FROM });
}

export const emailAvailable = () => !!override || emailConfigured();

/**
 * Verify a Resend webhook (Svix scheme): HMAC-SHA256 over `${id}.${timestamp}.${body}` with the
 * base64 secret after the `whsec_` prefix. Rejects timestamps older/newer than 5 minutes.
 */
export function verifyResendWebhook(
  rawBody: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  secret = env().RESEND_WEBHOOK_SECRET,
  now = Date.now()
) {
  if (!secret || !headers.id || !headers.timestamp || !headers.signature) return false;
  const ts = Number(headers.timestamp);
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > 300) return false;
  const key = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64');
  const expected = createHmac('sha256', key).update(`${headers.id}.${headers.timestamp}.${rawBody}`).digest();
  return headers.signature.split(' ').some((part) => {
    const [ver, sig] = part.split(',');
    if (ver !== 'v1' || !sig) return false;
    const got = Buffer.from(sig, 'base64');
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}
