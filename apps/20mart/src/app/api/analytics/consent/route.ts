import { NextResponse } from 'next/server';
import { analyticsConsentCookie, analyticsSessionCookie, analyticsVisitorCookie, browserOptOut, consentInput, getAnalyticsSettings, setAnalyticsConsent, trackingContext } from '@20mart/server';
import { customerRoute, parseJson } from '@20mart/server/next';

export const dynamic = 'force-dynamic';

/** Current analytics consent for this browser (no identifiers are issued by reading it). */
export const GET = customerRoute({ auth: 'optional' }, async ({ req, customer }) => {
  const ctx = await trackingContext(req, customer?.id ?? null);
  const { consentVersion } = await getAnalyticsSettings();
  return { analytics: ctx.consent, version: consentVersion, browserOptOut: browserOptOut(req.headers) };
});

/**
 * Grant or withdraw optional analytics. Withdrawing deletes this browser's behavioural events and
 * analytics sessions and clears the analytics cookies. Essential cookies (sign-in, cart, location)
 * are unaffected.
 */
export const POST = customerRoute({ auth: 'optional', rateLimit: { key: 'analytics-consent', limit: 20, windowMs: 60_000 } }, async ({ req }) => {
  const input = await parseJson(req, consentInput);
  const visitor = analyticsVisitorCookie();
  const r = await setAnalyticsConsent(input, req.cookies.get(visitor.name)?.value ?? null);
  const res = NextResponse.json({ analytics: r.consent }, { headers: { 'cache-control': 'no-store' } });
  const consent = analyticsConsentCookie();
  res.cookies.set(consent.name, r.cookieValue, consent.options);
  if (r.consent === 'denied') {
    const session = analyticsSessionCookie();
    res.cookies.set(visitor.name, '', { ...visitor.options, maxAge: 0 });
    res.cookies.set(session.name, '', { ...session.options, maxAge: 0 });
  }
  return res;
});
