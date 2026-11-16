/**
 * Centralised logging and error monitoring.
 *
 *  - Always: one structured JSON line per event on stdout/stderr (works with any log
 *    collector: Vercel/Render/Railway logs, CloudWatch, Loki, Datadog agent, journald…).
 *  - Optional: errors are forwarded to Sentry (SENTRY_DSN) and/or a generic HTTPS webhook
 *    (MONITORING_WEBHOOK_URL). Forwarding is fire-and-forget with a short timeout and can
 *    never break or slow down the request that produced the error.
 *
 * Redaction is applied to every field before it leaves the process: secrets, tokens, cookies,
 * signatures and card data are removed by key; e-mail addresses and phone numbers are masked
 * inside any string value. Never pass raw request bodies or headers to these functions.
 */
import { randomUUID } from 'node:crypto';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
/** Coarse area of the system, used for filtering and alert routing. */
export type LogCategory = 'api' | 'db' | 'auth' | 'payment' | 'order' | 'webhook' | 'notification' | 'cron' | 'perf' | 'storage' | 'app';

export interface LogFields {
  category?: LogCategory;
  requestId?: string;
  [key: string]: unknown;
}

const SENSITIVE_KEY = /pass(word|wd)?|secret|token|authorization|cookie|signature|api[-_]?key|private|card|cvv|cvc|pan\b|otp|session|credential|dsn/i;
const EMAIL = /([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
const PHONE = /(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{9}(?!\d)/g;
const BEARER = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi;
const MAX_STRING = 2000;

/** Mask PII and credentials that may appear inside free text (error messages, reasons…). */
export function redactString(s: string): string {
  return s
    .replace(BEARER, '$1 [REDACTED]')
    .replace(EMAIL, '$1***@$2')
    .replace(PHONE, (m) => `******${m.slice(-4)}`)
    .slice(0, MAX_STRING);
}

/** Deep-copy `value` with sensitive keys removed and PII masked. Cycles and depth are bounded. */
export function redact(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return serializeError(value);
  if (typeof value !== 'object') return String(value);
  if (depth > 6 || seen.has(value)) return '[Truncated]';
  seen.add(value);
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1, seen));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEY.test(k) ? '[REDACTED]' : redact(v, depth + 1, seen);
  }
  return out;
}

export interface SerializedError {
  name: string;
  message: string;
  code?: string;
  status?: number;
  stack?: string;
  cause?: SerializedError;
}

export function serializeError(err: unknown, depth = 0): SerializedError {
  if (!(err instanceof Error)) return { name: 'NonError', message: redactString(String(err)) };
  const e = err as Error & { code?: unknown; status?: unknown; cause?: unknown };
  return {
    name: e.name,
    message: redactString(e.message ?? ''),
    ...(typeof e.code === 'string' ? { code: e.code } : {}),
    ...(typeof e.status === 'number' ? { status: e.status } : {}),
    ...(e.stack ? { stack: redactString(e.stack.split('\n').slice(0, 15).join('\n')) } : {}),
    ...(e.cause && depth < 3 ? { cause: serializeError(e.cause, depth + 1) } : {}),
  };
}

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const minLevel = () => LEVELS[(process.env.LOG_LEVEL as LogLevel) in LEVELS ? (process.env.LOG_LEVEL as LogLevel) : 'info'];
const serviceName = () => process.env.SERVICE_NAME || 'twentymart';

/** Test hook: capture log lines instead of writing them. */
let sink: ((line: Record<string, unknown>) => void) | null = null;
export function setLogSinkForTests(fn: ((line: Record<string, unknown>) => void) | null) {
  sink = fn;
}

export function log(level: LogLevel, event: string, fields: LogFields = {}) {
  if (LEVELS[level] < minLevel()) return;
  const line = {
    ts: new Date().toISOString(),
    level,
    event,
    service: serviceName(),
    env: process.env.NODE_ENV,
    ...(redact(fields) as Record<string, unknown>),
  };
  if (sink) return sink(line);
  const text = JSON.stringify(line);
  if (level === 'error' || level === 'warn') process.stderr.write(text + '\n');
  else process.stdout.write(text + '\n');
}

export const logger = {
  debug: (event: string, f?: LogFields) => log('debug', event, f),
  info: (event: string, f?: LogFields) => log('info', event, f),
  warn: (event: string, f?: LogFields) => log('warn', event, f),
  error: (event: string, f?: LogFields) => log('error', event, f),
};

export const newRequestId = () => randomUUID();

/* ───────────────────────────── Error forwarding ───────────────────────────── */

interface ParsedDsn {
  endpoint: string;
  publicKey: string;
}

export function parseSentryDsn(dsn: string | undefined): ParsedDsn | null {
  if (!dsn) return null;
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\//, '').split('/').pop();
    if (!u.username || !projectId || u.protocol !== 'https:') return null;
    const prefix = u.pathname.replace(/\/?[^/]+$/, '');
    return { endpoint: `${u.protocol}//${u.host}${prefix}/api/${projectId}/envelope/`, publicKey: u.username };
  } catch {
    return null;
  }
}

type Fetch = typeof fetch;
let fetchImpl: Fetch | null = null;
/** Test hook: intercept outgoing monitoring requests. */
export function setMonitoringFetchForTests(f: Fetch | null) {
  fetchImpl = f;
}
const doFetch: Fetch = (...a) => (fetchImpl ?? fetch)(...a);

/** In-flight forwards, so tests (and graceful shutdown) can await delivery. */
const pending = new Set<Promise<unknown>>();
export const flushMonitoring = () => Promise.allSettled([...pending]);

function track(p: Promise<unknown>) {
  const t = p.catch(() => undefined).finally(() => pending.delete(t));
  pending.add(t);
}

function sendToSentry(dsn: ParsedDsn, eventId: string, err: SerializedError, event: string, fields: Record<string, unknown>) {
  const now = new Date().toISOString();
  const { category, requestId, ...extra } = fields;
  const payload = {
    event_id: eventId,
    timestamp: now,
    platform: 'node',
    level: 'error',
    logger: event,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    release: process.env.APP_RELEASE || undefined,
    server_name: serviceName(),
    tags: { category: String(category ?? 'app'), service: serviceName(), ...(err.code ? { code: err.code } : {}) },
    extra: { ...extra, requestId, stack: err.stack },
    exception: { values: [{ type: err.name, value: err.message }] },
  };
  const body = `${JSON.stringify({ event_id: eventId, sent_at: now })}\n${JSON.stringify({ type: 'event' })}\n${JSON.stringify(payload)}\n`;
  return doFetch(dsn.endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-sentry-envelope',
      'x-sentry-auth': `Sentry sentry_version=7, sentry_client=twentymart-observability/1.0, sentry_key=${dsn.publicKey}`,
    },
    body,
    signal: AbortSignal.timeout(3000),
  });
}

function sendToWebhook(url: string, eventId: string, err: SerializedError, event: string, fields: Record<string, unknown>) {
  return doFetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: eventId, ts: new Date().toISOString(), service: serviceName(), env: process.env.NODE_ENV, event, error: { ...err, stack: undefined }, ...fields }),
    signal: AbortSignal.timeout(3000),
  });
}

export const monitoringProviders = () => ({
  sentry: !!parseSentryDsn(process.env.SENTRY_DSN),
  webhook: /^https:\/\//.test(process.env.MONITORING_WEBHOOK_URL ?? ''),
});

/**
 * Record an error: structured log line + forward to configured providers.
 * Returns an event id that can be shown to the user / support as a reference.
 */
export function captureException(err: unknown, event: string, fields: LogFields = {}): string {
  const eventId = randomUUID().replace(/-/g, '');
  const serialized = serializeError(err);
  const safe = redact(fields) as Record<string, unknown>;
  log('error', event, { ...safe, eventId, error: serialized });
  const dsn = parseSentryDsn(process.env.SENTRY_DSN);
  if (dsn) track(sendToSentry(dsn, eventId, serialized, event, safe));
  const hook = process.env.MONITORING_WEBHOOK_URL;
  if (hook && /^https:\/\//.test(hook)) track(sendToWebhook(hook, eventId, serialized, event, safe));
  return eventId;
}
