import { prisma } from '@20mart/database';
import { z } from 'zod';
import { assertPermission, type AdminContext } from '../auth/admin';
import { audit } from '../audit';
import { badRequest } from '../errors';

const DEFAULT_ID = 'default';
const CACHE_MS = 60_000;

export type AnalyticsSettingsRow = Awaited<ReturnType<typeof loadSettings>>;
let cache: { row: AnalyticsSettingsRow; at: number } | null = null;

async function loadSettings() {
  return (
    (await prisma.analyticsSettings.findUnique({ where: { id: DEFAULT_ID } })) ??
    (await prisma.analyticsSettings.upsert({ where: { id: DEFAULT_ID }, update: {}, create: { id: DEFAULT_ID } }))
  );
}

/** Analytics settings (singleton), cached per process for a minute so event ingestion stays cheap. */
export async function getAnalyticsSettings(opts: { fresh?: boolean } = {}) {
  if (!opts.fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.row;
  const row = await loadSettings();
  cache = { row, at: Date.now() };
  return row;
}

/** Test hook. */
export function clearAnalyticsSettingsCache() {
  cache = null;
}

const days = (min: number, max: number) => z.number().int().min(min).max(max);

export const analyticsSettingsInput = z
  .object({
    /** Raw behavioural events: at least 30 days, at most 2 years. */
    behavioralRetentionDays: days(30, 730),
    /** Raw operational events: at least 30 days, at most 10 years. */
    operationalRetentionDays: days(30, 3650),
    cartAbandonmentHours: z.number().int().min(1).max(720),
    sessionIdleMinutes: z.number().int().min(5).max(240),
    consentVersion: z.number().int().min(1).max(9999),
  })
  .partial()
  .strict();

export async function updateAnalyticsSettings(actor: AdminContext, raw: unknown) {
  assertPermission(actor, 'analytics.manage');
  const input = analyticsSettingsInput.parse(raw);
  const current = await getAnalyticsSettings({ fresh: true });
  const next = { ...current, ...input };
  if (next.operationalRetentionDays < next.behavioralRetentionDays) {
    throw badRequest('Operational event retention cannot be shorter than behavioural event retention');
  }
  if (input.consentVersion !== undefined && input.consentVersion < current.consentVersion) {
    throw badRequest('The consent version can only be increased');
  }
  const row = await prisma.$transaction(async (tx) => {
    const s = await tx.analyticsSettings.update({ where: { id: DEFAULT_ID }, data: { ...input, updatedById: actor.admin.id } });
    const changes = (Object.keys(input) as (keyof typeof input)[]).map((k) => `${k}: ${current[k]} → ${input[k]}`);
    await audit(tx, actor, {
      action: 'Updated analytics settings',
      category: 'SETTINGS',
      entityType: 'AnalyticsSettings',
      details: changes.join(', ') || 'no changes',
    });
    return s;
  });
  cache = { row, at: Date.now() };
  return row;
}
