import { adminRoute, clientMeta } from '@20mart/server/next';
import { AppError, auditProductDemandExport, exportProductDemandCsv, rateLimit } from '@20mart/server';

export const dynamic = 'force-dynamic';

/**
 * CSV export of the filtered product demand list. Aggregates only (no customer data), behind
 * analytics.view, rate limited per admin, and recorded in the audit log.
 */
export const GET = adminRoute('analytics.view', async ({ req, admin }) => {
  const limit = await rateLimit(`analytics-export:${admin.admin.id}`, 10, 10 * 60_000);
  if (!limit.ok) throw new AppError(429, 'RATE_LIMITED', 'Too many exports. Please wait a few minutes.');
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const out = await exportProductDemandCsv(params);
  await auditProductDemandExport(admin, out, req.nextUrl.search, clientMeta(req).ipAddress);
  return new Response(out.csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${out.filename}"`,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'x-analytics-event-coverage': out.coverage.eventCoverage,
      'x-analytics-missing-days': String(out.coverage.missingDays.length),
    },
  });
});
