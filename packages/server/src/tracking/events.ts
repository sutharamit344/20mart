/**
 * Analytics event infrastructure.
 *
 * Two kinds of event, kept apart:
 *  - BEHAVIORAL (browser: page views, searches). Recorded ONLY with analytics consent.
 *  - OPERATIONAL (server: cart, checkout, stock, order signals). Always recorded, because they describe
 *    demand for products rather than a person — but WITHOUT user/visitor/session identity unless the
 *    visitor consented.
 *
 * Guarantees:
 *  - Prices, stock, categories and identity come from the server, never from the request body.
 *  - Browser payloads are strict: unknown fields (e.g. a price) reject the batch.
 *  - Event ids are UUIDs; re-sent events are ignored (deduplication).
 *  - Nothing here ever throws into a customer-facing flow: recordServerEvent swallows and logs failures.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { prisma, Prisma } from '@20mart/database';
import { z } from 'zod';
import { CLIENT_EVENT_NAMES, MAX_CLIENT_EVENT_BATCH, SERVER_EVENT_NAMES, parseConsent, type ConsentState, type ServerEventName } from '@20mart/shared';
import { sha256 } from '../crypto';
import { analyticsConsentCookie, analyticsSessionCookie, analyticsVisitorCookie, locationCookie } from '../cookies';
import { env } from '../env';
import { logger } from '../observability';
import { PINCODE_REGEX } from '../settings';
import { getAnalyticsSettings } from './settings';

/* ───────────────────────── request context ───────────────────────── */

/** What the server knows about the caller. Built from cookies/headers only. */
export interface TrackingContext {
  consent: ConsentState;
  /** Raw visitor/session cookie values (hashed before storage). */
  visitorToken: string | null;
  sessionToken: string | null;
  /** Signed-in customer resolved from the HTTP-only session cookie. */
  userId: string | null;
  pincode: string | null;
  userAgent: string | null;
}

interface RequestLike {
  headers: Headers;
  cookies: { get(name: string): { value: string } | undefined };
}

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;
const token = (v: string | undefined) => (v && TOKEN_RE.test(v) ? v : null);
const newToken = () => randomBytes(24).toString('base64url');

/** Global Privacy Control / Do Not Track: treated as a refusal of optional analytics. */
export function browserOptOut(headers: Headers) {
  return headers.get('sec-gpc') === '1' || headers.get('dnt') === '1';
}

export async function trackingContext(req: RequestLike, userId: string | null): Promise<TrackingContext> {
  const settings = await getAnalyticsSettings();
  const raw = req.cookies.get(analyticsConsentCookie().name)?.value;
  const consent = browserOptOut(req.headers) ? 'denied' : parseConsent(raw, settings.consentVersion);
  const pin = req.cookies.get(locationCookie().name)?.value ?? null;
  return {
    consent,
    visitorToken: consent === 'granted' ? token(req.cookies.get(analyticsVisitorCookie().name)?.value) : null,
    sessionToken: consent === 'granted' ? token(req.cookies.get(analyticsSessionCookie().name)?.value) : null,
    userId,
    pincode: pin && PINCODE_REGEX.test(pin) ? pin : null,
    userAgent: req.headers.get('user-agent')?.slice(0, 255) ?? null,
  };
}

/** Identity columns for an event: empty unless the visitor granted analytics consent. */
function identity(ctx: TrackingContext | null | undefined) {
  if (!ctx || ctx.consent !== 'granted') return { userId: null, visitorId: null, sessionId: null };
  return {
    userId: ctx.userId,
    visitorId: ctx.visitorToken ? sha256(ctx.visitorToken) : null,
    sessionId: ctx.sessionToken ? sha256(ctx.sessionToken) : null,
  };
}

/* ───────────────────────── validation helpers ───────────────────────── */

const id = z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);
const EMAIL_RE = /[^\s@]+@[^\s@]+/;
const LONG_DIGITS_RE = /\d{7,}/;

/** True for strings that may carry personal data (emails, phone numbers, long numbers). */
export function looksPersonal(s: string) {
  return EMAIL_RE.test(s) || LONG_DIGITS_RE.test(s.replace(/[\s()+-]/g, ''));
}

/** Lower-case, collapse whitespace, cap length. Returns null for empty or personal-looking terms. */
export function normaliseSearchTerm(raw: string | null | undefined) {
  const t = (raw ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!t || looksPersonal(t)) return null;
  return t;
}

const META_KEY = /^[a-zA-Z][a-zA-Z0-9_]{0,31}$/;
/** Whitelisted, small, non-personal context only. */
export const eventMetadata = z
  .record(z.union([z.string().max(64), z.number().finite(), z.boolean()]))
  .refine((m) => Object.keys(m).length <= 8, 'Too many metadata keys')
  .refine((m) => Object.keys(m).every((k) => META_KEY.test(k)), 'Invalid metadata key')
  .refine((m) => Object.values(m).every((v) => typeof v !== 'string' || !looksPersonal(v)), 'Metadata must not contain personal data');

const BOT_RE = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|curl|wget|python-requests/i;
export const isBot = (ua: string | null) => !ua || BOT_RE.test(ua);

function deviceType(ua: string | null) {
  if (!ua) return null;
  if (/ipad|tablet/i.test(ua)) return 'tablet';
  if (/mobi|android|iphone/i.test(ua)) return 'mobile';
  return 'desktop';
}

/* ───────────────────────── server-side events ───────────────────────── */

export const serverEventInput = z
  .object({
    name: z.enum(SERVER_EVENT_NAMES),
    productId: id.optional(),
    variantId: id.optional(),
    categoryId: id.optional(),
    cartId: id.optional(),
    orderId: id.optional(),
    warehouseId: id.optional(),
    zoneId: id.optional(),
    pincode: z.string().regex(PINCODE_REGEX).optional(),
    quantity: z.number().int().min(0).max(10_000).optional(),
    /** Server-resolved price. Callers pass a value read from the database, never from the request. */
    unitPricePaise: z.number().int().min(0).max(100_000_000).optional(),
    metadata: eventMetadata.optional(),
    occurredAt: z.date().optional(),
  })
  .strict();
export type ServerEventInput = z.input<typeof serverEventInput>;

/**
 * Record an OPERATIONAL event from server code. Call it AFTER the business transaction has committed,
 * outside any transaction. It never throws: an analytics failure is logged and ignored, so checkout,
 * cart and order flows can never fail because of analytics. Returns whether the event was stored.
 */
export async function recordServerEvent(input: ServerEventInput, ctx?: TrackingContext | null): Promise<boolean> {
  try {
    const e = serverEventInput.parse(input);
    await prisma.analyticsEvent.create({
      data: {
        id: randomUUID(),
        name: e.name,
        category: 'OPERATIONAL',
        source: 'SERVER',
        occurredAt: e.occurredAt ?? new Date(),
        ...identity(ctx),
        productId: e.productId,
        variantId: e.variantId,
        categoryId: e.categoryId,
        cartId: e.cartId,
        orderId: e.orderId,
        warehouseId: e.warehouseId,
        zoneId: e.zoneId,
        pincode: e.pincode ?? ctx?.pincode ?? null,
        quantity: e.quantity,
        unitPricePaise: e.unitPricePaise,
        metadata: e.metadata,
      },
    });
    return true;
  } catch (err) {
    logger.warn('analytics.record_failed', { category: 'app', event: (input as { name?: string })?.name, error: (err as Error)?.message?.slice(0, 200) });
    return false;
  }
}

/* ───────────────────────── browser events ───────────────────────── */

const clientEvent = z
  .object({
    id: z.string().uuid(),
    name: z.enum(CLIENT_EVENT_NAMES),
    /** Client clock (epoch ms). Used only if plausible; otherwise the server time is used. */
    occurredAt: z.number().int().positive().optional(),
    productId: id.optional(),
    variantId: id.optional(),
    categoryId: id.optional(),
    searchTerm: z.string().max(200).optional(),
    resultCount: z.number().int().min(0).max(100_000).optional(),
  })
  .strict();

const utm = z.string().trim().toLowerCase().max(64).regex(/^[a-z0-9_.-]*$/).optional().catch(undefined);
const clientContext = z
  .object({
    path: z.string().max(500).optional(),
    referrer: z.string().max(500).optional(),
    utmSource: utm,
    utmMedium: utm,
    utmCampaign: utm,
  })
  .strict();

export const clientEventBatch = z
  .object({ events: z.array(clientEvent).min(1).max(MAX_CLIENT_EVENT_BATCH), context: clientContext.optional() })
  .strict();

const PAST_MS = 24 * 3_600_000;
const FUTURE_MS = 2 * 60_000;
function eventTime(clientMs: number | undefined, now: Date) {
  if (!clientMs) return now;
  const t = now.getTime();
  return clientMs >= t - PAST_MS && clientMs <= t + FUTURE_MS ? new Date(Math.min(clientMs, t)) : now;
}

function landingPath(p: string | undefined) {
  if (!p || !p.startsWith('/') || p.startsWith('//')) return null;
  const path = p.split(/[?#]/)[0].slice(0, 200);
  return looksPersonal(path) ? null : path;
}
function referrerHost(r: string | undefined) {
  if (!r) return null;
  try {
    const host = new URL(r).hostname.toLowerCase();
    return host && host !== new URL(env().APP_URL).hostname ? host.slice(0, 120) : null;
  } catch {
    return null;
  }
}

export interface IngestResult {
  accepted: number;
  duplicates: number;
  dropped: number;
  reason?: 'no_consent' | 'bot';
  /** Cookies the route must set (new visitor/session tokens), with the session idle timeout. */
  setVisitorToken?: string;
  setSessionToken?: string;
  sessionIdleMinutes: number;
}

/**
 * Ingest a batch of browser events. Throws ZodError (→ 400) for malformed batches.
 * Without consent nothing is stored and no identifier is issued.
 */
export async function ingestClientEvents(raw: unknown, ctx: TrackingContext, now = new Date()): Promise<IngestResult> {
  const batch = clientEventBatch.parse(raw);
  const settings = await getAnalyticsSettings();
  const base = { accepted: 0, duplicates: 0, sessionIdleMinutes: settings.sessionIdleMinutes };
  if (ctx.consent !== 'granted') return { ...base, dropped: batch.events.length, reason: 'no_consent' };
  if (isBot(ctx.userAgent)) return { ...base, dropped: batch.events.length, reason: 'bot' };

  // Identifiers are issued only now, after consent.
  const visitorToken = ctx.visitorToken ?? newToken();
  const sessionToken = ctx.sessionToken ?? newToken();
  const visitorId = sha256(visitorToken);
  const sessionId = sha256(sessionToken);

  // Resolve products, variants and categories on the server (price snapshot + category).
  const productIds = [...new Set(batch.events.map((e) => e.productId).filter((v): v is string => !!v))];
  const variantIds = [...new Set(batch.events.map((e) => e.variantId).filter((v): v is string => !!v))];
  const categoryIds = [...new Set(batch.events.map((e) => e.categoryId).filter((v): v is string => !!v))];
  const [products, categories] = await Promise.all([
    productIds.length
      ? prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, categoryId: true, sellingPricePaise: true, variants: { where: { id: { in: variantIds } }, select: { id: true, sellingPricePaise: true } } },
        })
      : [],
    categoryIds.length ? prisma.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true } }) : [],
  ]);
  const productById = new Map(products.map((p) => [p.id, p]));
  const categorySet = new Set(categories.map((c) => c.id));

  const rows: Prisma.AnalyticsEventCreateManyInput[] = [];
  let dropped = 0;
  for (const e of batch.events) {
    const needsProduct = e.name === 'PRODUCT_VIEWED' || e.name === 'PRODUCT_UNAVAILABLE_VIEWED';
    const product = e.productId ? productById.get(e.productId) : undefined;
    if ((needsProduct && !product) || (e.productId && !product)) {
      dropped++;
      continue;
    }
    const variant = e.variantId ? product?.variants.find((v) => v.id === e.variantId) : undefined;
    if (e.variantId && !variant) {
      dropped++;
      continue;
    }
    if (e.name === 'CATEGORY_VIEWED' && (!e.categoryId || !categorySet.has(e.categoryId))) {
      dropped++;
      continue;
    }
    const isSearch = e.name === 'PRODUCT_SEARCHED';
    if (isSearch && !e.searchTerm?.trim()) {
      dropped++;
      continue;
    }
    const term = isSearch ? normaliseSearchTerm(e.searchTerm) : null;
    rows.push({
      id: e.id,
      name: e.name,
      category: 'BEHAVIORAL',
      source: 'CLIENT',
      occurredAt: eventTime(e.occurredAt, now),
      userId: ctx.userId,
      visitorId,
      sessionId,
      productId: product?.id ?? null,
      variantId: variant?.id ?? null,
      categoryId: product?.categoryId ?? (e.categoryId && categorySet.has(e.categoryId) ? e.categoryId : null),
      pincode: ctx.pincode,
      unitPricePaise: product ? (variant?.sellingPricePaise ?? product.sellingPricePaise) : null,
      searchTerm: term,
      resultCount: isSearch ? (e.resultCount ?? null) : null,
      metadata: isSearch && !term ? { termRedacted: true } : undefined,
    });
  }

  const inserted = rows.length ? (await prisma.analyticsEvent.createMany({ data: rows, skipDuplicates: true })).count : 0;

  if (rows.length) {
    const c = batch.context;
    await prisma.analyticsSession.upsert({
      where: { id: sessionId },
      create: {
        id: sessionId,
        visitorId,
        userId: ctx.userId,
        startedAt: now,
        lastSeenAt: now,
        landingPath: landingPath(c?.path),
        referrerHost: referrerHost(c?.referrer),
        utmSource: c?.utmSource || null,
        utmMedium: c?.utmMedium || null,
        utmCampaign: c?.utmCampaign || null,
        deviceType: deviceType(ctx.userAgent),
        eventCount: inserted,
      },
      // Anonymous → authenticated linking: the first signed-in event attaches the customer.
      update: { lastSeenAt: now, eventCount: { increment: inserted }, ...(ctx.userId ? { userId: ctx.userId } : {}) },
    });
  }

  return {
    ...base,
    accepted: inserted,
    duplicates: rows.length - inserted,
    dropped,
    ...(ctx.visitorToken ? {} : { setVisitorToken: visitorToken }),
    // Always re-set the session cookie so its idle timeout slides.
    setSessionToken: sessionToken,
  };
}

/* ───────────────────────── consent ───────────────────────── */

export const consentInput = z.object({ analytics: z.boolean() }).strict();

/**
 * Record the visitor's analytics choice. Withdrawing consent deletes the visitor's raw behavioural
 * events and sessions, and removes their identity from operational events.
 */
export async function setAnalyticsConsent(raw: unknown, rawVisitorToken: string | null) {
  const { analytics } = consentInput.parse(raw);
  const settings = await getAnalyticsSettings();
  const value = `${settings.consentVersion}.${analytics ? 'granted' : 'denied'}`;
  let erased = { events: 0, sessions: 0 };
  const vt = token(rawVisitorToken ?? undefined);
  if (!analytics && vt) {
    const visitorId = sha256(vt);
    const [del, , sessions] = await prisma.$transaction([
      prisma.analyticsEvent.deleteMany({ where: { visitorId, category: 'BEHAVIORAL' } }),
      prisma.analyticsEvent.updateMany({ where: { visitorId, category: 'OPERATIONAL' }, data: { visitorId: null, sessionId: null, userId: null } }),
      prisma.analyticsSession.deleteMany({ where: { visitorId } }),
    ]);
    erased = { events: del.count, sessions: sessions.count };
  }
  return { consent: analytics ? ('granted' as const) : ('denied' as const), cookieValue: value, erased };
}
