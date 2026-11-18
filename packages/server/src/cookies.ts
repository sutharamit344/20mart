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

/** Guest cart token (random; only its SHA-256 is stored as Cart.sessionId). */
export function guestCartCookie() {
  const secure = secureFor(env().APP_URL);
  return {
    name: secure ? '__Host-20m_cart' : '20m_cart',
    options: { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 30 * 24 * 60 * 60 } satisfies CookieOptions,
  };
}

/**
 * Selected delivery PIN code. Not a secret (readable by the page to show "Delivering to …");
 * every server use re-validates it and it never grants access to anything.
 */
export function locationCookie() {
  const secure = secureFor(env().APP_URL);
  return {
    name: '20m_pin',
    options: { httpOnly: false, secure, sameSite: 'lax', path: '/', maxAge: 180 * 24 * 60 * 60 } satisfies CookieOptions,
  };
}

/**
 * Analytics consent decision (`<version>.<granted|denied>`). Readable by the page so it can skip
 * sending events; the server re-checks it on every request and it grants nothing.
 */
export function analyticsConsentCookie() {
  const secure = secureFor(env().APP_URL);
  return {
    name: '20m_consent',
    options: { httpOnly: false, secure, sameSite: 'lax', path: '/', maxAge: 365 * 24 * 60 * 60 } satisfies CookieOptions,
  };
}

/** Pseudonymous visitor id; set ONLY after analytics consent. Only its SHA-256 is stored. */
export function analyticsVisitorCookie() {
  const secure = secureFor(env().APP_URL);
  return {
    name: secure ? '__Host-20m_vid' : '20m_vid',
    options: { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 365 * 24 * 60 * 60 } satisfies CookieOptions,
  };
}

/** Browsing-session id (sliding idle timeout set per response); set ONLY after analytics consent. */
export function analyticsSessionCookie(idleMinutes = 30) {
  const secure = secureFor(env().APP_URL);
  return {
    name: secure ? '__Host-20m_sid' : '20m_sid',
    options: { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: idleMinutes * 60 } satisfies CookieOptions,
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
