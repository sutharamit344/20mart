import { env } from './env';

export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict';
  path: string;
  maxAge?: number;
}

const secureFor = (url: string) => env().NODE_ENV === 'production' || url.startsWith('https://');

/**
 * Cookie names use the `__Host-` prefix when served over HTTPS, which forces
 * Secure, Path=/ and no Domain (cannot be set by sibling subdomains).
 */
export function customerSessionCookie() {
  const secure = secureFor(env().APP_URL);
  return {
    name: secure ? '__Host-20m_session' : '20m_session',
    // Lax is required: the Google OAuth redirect back to us is a cross-site top-level GET.
    options: { httpOnly: true, secure, sameSite: 'lax', path: '/' } satisfies CookieOptions,
  };
}

export function oauthStateCookie() {
  const secure = secureFor(env().APP_URL);
  return {
    name: secure ? '__Host-20m_oauth' : '20m_oauth',
    options: { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 600 } satisfies CookieOptions,
  };
}

export function adminSessionCookie() {
  const secure = secureFor(env().ADMIN_APP_URL);
  return {
    name: secure ? '__Host-20m_admin' : '20m_admin',
    options: { httpOnly: true, secure, sameSite: 'strict', path: '/' } satisfies CookieOptions,
  };
}

/** Session lifetimes. */
export const CUSTOMER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days (sliding)
export const ADMIN_SESSION_ABSOLUTE_MS = 12 * 60 * 60 * 1000; // 12 hours absolute
export const ADMIN_SESSION_IDLE_MS = 2 * 60 * 60 * 1000; // 2 hours idle
export const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000; // write lastSeenAt at most every 5 min
