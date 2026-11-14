import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from './env';

/** 256-bit URL-safe random token. */
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');

/** Hash for storing session tokens at rest. Tokens are high-entropy so a fast hash is appropriate. */
export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Sign a JSON payload (for short-lived cookies such as the OAuth state). */
export function signPayload(payload: object): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = createHmac('sha256', env().AUTH_SECRET).update(body).digest('base64url');
  return `${body}.${mac}`;
}

export function verifyPayload<T>(signed: string | undefined | null): T | null {
  if (!signed) return null;
  const idx = signed.lastIndexOf('.');
  if (idx <= 0) return null;
  const body = signed.slice(0, idx);
  const mac = signed.slice(idx + 1);
  const expected = createHmac('sha256', env().AUTH_SECRET).update(body).digest('base64url');
  if (!safeEqual(mac, expected)) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

/** PKCE S256 code challenge. */
export const pkceChallenge = (verifier: string) => createHash('sha256').update(verifier).digest('base64url');
