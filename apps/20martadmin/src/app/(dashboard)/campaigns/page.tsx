import Link from 'next/link';
import { campaignListQuery, listCampaigns } from '@20mart/server';
import { requireAdminPage } from '@20mart/server/next';
import { Plus } from 'lucide-react';
import { AccessDenied, PageHeader, Pagination, Panel, StatusBadge, Table, TableEmpty, TBody, Td, Th, THead } from '../../../components/ui';
import { FilterBar } from '../../../components/FilterBar';

export const dynamic = 'force-dynamic';

const when = (d: Date | null) => (d ? d.toLocaleDateString('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }) : 'No end');
const STATE_TONE: Record<string, string> = { LIVE: 'ACTIVE', SCHEDULED: 'LOW', ENDED: 'ARCHIVED', INACTIVE: 'INACTIVE' };

export default async function CampaignsPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  const ctx = await requireAdminPage();
  if (!ctx.permissions.has('campaigns.view')) return <AccessDenied permission="campaigns.view" />;
  const parsed = campaignListQuery.safeParse(searchParams);
  const data = await listCampaigns(parsed.success ? parsed.data : {});
  return (
    <div className="space-y-3 sm:space-y-4">
      <PageHeader
        title="Campaigns"
        description="Customers only see live campaigns (active and within dates). Fill Your Cart demand is tracked separately from sales."
        actions={
          ctx.permissions.has('campaigns.create') && (
            <Link href="/campaigns/new" className="inline-flex h-8 items-center gap-1 rounded-lg bg-brand-green px-3 text-xs font-bold text-white hover:bg-brand-green-hover">
              <Plus className="h-3.5 w-3.5" /> New campaign
            </Link>
          )
        }
      />
      <FilterBar
        placeholder="Campaign name…"
        selects={[{ name: 'type', label: 'Any type', options: [{ value: 'PROMOTION', label: 'Promotion' }, { value: 'FILL_YOUR_CART', label: 'Fill Your Cart' }] }]}
      />
      <Panel>
        <Table minWidth={820}>
          <THead>
            <Th>Campaign</Th>
            <Th>Type</Th>
            <Th>Dates</Th>
            <Th>Coupon</Th>
            <Th className="text-right">Products</Th>
            <Th className="text-right">Participants</Th>
            <Th>Status</Th>
          </THead>
          <TBody>
            {data.items.length === 0 && <TableEmpty colSpan={7} title="No campaigns" description="Create a promotion or a Fill Your Cart campaign." />}
            {data.items.map((c) => (
              <tr key={c.id} className="hover:bg-surface-muted/60">
                <Td>
                  <Link href={`/campaigns/${c.id}`} className="font-bold text-ink hover:text-brand-orange-600">
                    {c.name}
                  </Link>
                  <p className="font-mono text-2xs text-ink-400">/campaigns/{c.slug}</p>
                </Td>
                <Td>{c.type === 'FILL_YOUR_CART' ? 'Fill Your Cart' : 'Promotion'}</Td>
                <Td className="whitespace-nowrap text-ink-600">
                  {when(c.startsAt)} → {when(c.endsAt)}
                </Td>
                <Td className="font-mono text-2xs">{c.coupon?.code ?? '—'}</Td>
                <Td className="text-right tabular-nums">{c._count.products}</Td>
                <Td className="text-right tabular-nums">{c.type === 'FILL_YOUR_CART' ? c._count.participants : '—'}</Td>
                <Td>
                  <StatusBadge status={STATE_TONE[c.state]} label={c.state.charAt(0) + c.state.slice(1).toLowerCase()} />
                </Td>
              </tr>
            ))}
          </TBody>
        </Table>
        <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/campaigns" params={searchParams} />
      </Panel>
    </div>
  );
}
