import { emailAvailable, emailLogQuery, listEmailLog } from '@20mart/server';
import { requireAdminPage } from '@20mart/server/next';
import { AccessDenied, PageHeader, Pagination, Panel, StatusBadge, Table, TableEmpty, TBody, Td, Th, THead } from '../../../components/ui';
import { FilterBar } from '../../../components/FilterBar';
import { RetryEmail } from './RetryEmail';

export const dynamic = 'force-dynamic';

const STATUSES = ['QUEUED', 'SENT', 'DELIVERED', 'BOUNCED', 'COMPLAINED', 'FAILED', 'SKIPPED'] as const;
const TYPES = ['WELCOME', 'ORDER_CONFIRMATION', 'PAYMENT_CONFIRMATION', 'ORDER_STATUS', 'ORDER_CANCELLED', 'COUPON_ISSUED', 'CAMPAIGN_ANNOUNCEMENT'] as const;
const nice = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');
const TONE: Record<string, string> = { DELIVERED: 'ACTIVE', SENT: 'IN_STOCK', QUEUED: 'DRAFT', SKIPPED: 'INACTIVE', FAILED: 'OUT', BOUNCED: 'OUT', COMPLAINED: 'LOW' };
const when = (d: Date | null) => (d ? d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) : '—');

export default async function EmailLogPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  const ctx = await requireAdminPage();
  if (!ctx.permissions.has('notifications.view')) return <AccessDenied permission="notifications.view" />;
  const data = await listEmailLog(emailLogQuery.safeParse(searchParams).success ? searchParams : {});
  const configured = emailAvailable();
  const canRetry = ctx.permissions.has('notifications.manage');
  return (
    <div className="space-y-3 sm:space-y-4">
      <PageHeader
        title="Email log"
        description="Sent = accepted by Resend. Delivered / bounced only come from verified Resend webhooks — nothing is assumed."
      />
      {!configured && (
        <p role="status" className="rounded-lg border border-warning-line bg-warning-soft p-2.5 text-xs text-warning">
          Email is not configured: set <code>RESEND_API_KEY</code> and <code>EMAIL_FROM</code> (a verified sending domain). Until then emails are recorded as <b>Skipped</b> and customers still get in-app notifications.
        </p>
      )}
      <div className="flex flex-wrap gap-1.5 text-2xs">
        {STATUSES.map((s) => (
          <span key={s} className="rounded-lg border border-line-subtle bg-surface px-2 py-1">
            {nice(s)} <b className="tabular-nums">{data.byStatus[s] ?? 0}</b>
          </span>
        ))}
      </div>
      <FilterBar
        placeholder="Recipient or subject…"
        selects={[
          { name: 'status', label: 'Any status', options: STATUSES.map((s) => ({ value: s, label: nice(s) })) },
          { name: 'type', label: 'Any type', options: TYPES.map((s) => ({ value: s, label: nice(s) })) },
        ]}
      />
      <Panel>
        <Table minWidth={860}>
          <THead>
            <Th>Created</Th>
            <Th>Type</Th>
            <Th>To / subject</Th>
            <Th>Status</Th>
            <Th>Attempts</Th>
            <Th>Detail</Th>
          </THead>
          <TBody>
            {data.items.length === 0 && <TableEmpty colSpan={6} title="No emails" description="Order, coupon and campaign emails appear here." />}
            {data.items.map((m) => (
              <tr key={m.id}>
                <Td className="whitespace-nowrap text-ink-500">{when(m.createdAt)}</Td>
                <Td>{nice(m.type)}</Td>
                <Td className="max-w-[18rem]">
                  <p className="truncate font-semibold text-ink-800">{m.toEmail || '—'}</p>
                  <p className="truncate text-2xs text-ink-500">{m.subject}</p>
                </Td>
                <Td>
                  <StatusBadge status={TONE[m.status] ?? 'DRAFT'} label={nice(m.status)} />
                </Td>
                <Td className="tabular-nums">{m.attempts}</Td>
                <Td className="max-w-[14rem] text-2xs text-ink-500">
                  {m.deliveredAt ? `Delivered ${when(m.deliveredAt)}` : m.sentAt ? `Accepted ${when(m.sentAt)}` : m.lastError ?? ''}
                  {canRetry && (m.status === 'FAILED' || m.status === 'SKIPPED') && <RetryEmail id={m.id} />}
                </Td>
              </tr>
            ))}
          </TBody>
        </Table>
        <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/notifications" params={searchParams} />
      </Panel>
    </div>
  );
}
