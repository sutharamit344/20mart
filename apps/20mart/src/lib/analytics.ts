'use client';

/**
 * Browser side of first-party analytics.
 *  - Sends NOTHING unless the visitor has chosen "Allow analytics" (consent cookie) and the browser
 *    is not signalling Global Privacy Control / Do Not Track. The server enforces the same rules.
 *  - Only browsing events are sent from here; prices, stock and identity are resolved on the server.
 *  - Events are batched and sent with `fetch(..., { keepalive: true })`; failures are silently dropped
 *    and never affect the page.
 */
import { CONSENT_COOKIE, MAX_CLIENT_EVENT_BATCH, type ClientEventName } from '@20mart/shared';

export const CONSENT_EVENT = '20m:consent-open';
export const CONSENT_CHANGED_EVENT = '20m:consent-changed';

export interface TrackProps {
  productId?: string;
  variantId?: string;
  categoryId?: string;
  searchTerm?: string;
  resultCount?: number;
}

function readCookie(name: string) {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
}

export function browserOptsOut() {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.globalPrivacyControl === true || nav.doNotTrack === '1';
}

/** The stored choice (version is checked by the server). */
export function storedConsent(): 'granted' | 'denied' | null {
  const v = readCookie(CONSENT_COOKIE);
  if (!v) return null;
  if (v.endsWith('.granted')) return 'granted';
  if (v.endsWith('.denied')) return 'denied';
  return null;
}

export const analyticsAllowed = () => storedConsent() === 'granted' && !browserOptsOut();

const queue: (TrackProps & { id: string; name: ClientEventName; occurredAt: number })[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function uuid() {
  const c: Crypto = globalThis.crypto;
  if (typeof c.randomUUID === 'function') return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function context() {
  const p = new URLSearchParams(window.location.search);
  const utm = (k: string) => p.get(k)?.toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 64) || undefined;
  return {
    path: window.location.pathname.slice(0, 200),
    referrer: document.referrer ? document.referrer.slice(0, 500) : undefined,
    utmSource: utm('utm_source'),
    utmMedium: utm('utm_medium'),
    utmCampaign: utm('utm_campaign'),
  };
}

export function flush() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!queue.length) return;
  if (!analyticsAllowed()) {
    queue.length = 0;
    return;
  }
  const events = queue.splice(0, MAX_CLIENT_EVENT_BATCH);
  fetch('/api/analytics/events', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ events, context: context() }),
    keepalive: true,
    credentials: 'same-origin',
  })
    .then(async (r) => {
      // A choice made under an older consent version: ask again.
      if (r.status === 202) {
        const body = (await r.json().catch(() => null)) as { reason?: string } | null;
        if (body?.reason === 'no_consent' && !browserOptsOut()) window.dispatchEvent(new Event(CONSENT_EVENT));
      }
    })
    .catch(() => {});
  if (queue.length) flush();
}

let listening = false;
function listen() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  const onHide = () => flush();
  window.addEventListener('pagehide', onHide);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') onHide();
  });
}

/** Queue a browsing event. A no-op without analytics consent. */
export function track(name: ClientEventName, props: TrackProps = {}) {
  if (typeof window === 'undefined' || !analyticsAllowed()) return;
  listen();
  queue.push({ id: uuid(), name, occurredAt: Date.now(), ...props });
  if (queue.length >= MAX_CLIENT_EVENT_BATCH) flush();
  else if (!timer) timer = setTimeout(flush, 4000);
}

/** Save the visitor's choice on the server (which also sets/clears the analytics cookies). */
export async function saveConsent(analytics: boolean) {
  if (!analytics) queue.length = 0;
  const r = await fetch('/api/analytics/consent', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ analytics }),
    credentials: 'same-origin',
  });
  if (!r.ok) throw new Error('Could not save your choice');
  window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT));
}
