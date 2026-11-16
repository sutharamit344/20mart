import Link from 'next/link';
import { couponListQuery, listCoupons } from '@20mart/server';
import { requireAdminPage } from '@20mart/server/next';
import { Plus } from 'lucide-react';
import { AccessDenied, formatINR, PageHeader, Pagination, Panel, StatusBadge, Table, TableEmpty, TBody, Td, Th, THead } from '../../../components/ui';
import { FilterBar } from '../../../components/FilterBar';
import { couponState } from './coupon-state';

export const dynamic = 'force-dynamic';

const when = (d: Date | null) => (d ? d.toLocaleDateString('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }) : '—');

export default async function CouponsPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const ctx = await requireAdminPage();
  if (!ctx.permissions.has('coupons.view')) return <AccessDenied permission="coupons.view" />;
  const parsed = couponListQuery.safeParse(searchParams);
  const data = await listCoupons(parsed.success ? parsed.data : {});
  return (
    <div className="space-y-3 sm:space-y-4">
      <PageHeader
        title="Coupons"
        description="Discounts are calculated on the server at checkout. Issued ≠ redeemed: redemptions count only placed orders (cancelled orders give the use back)."
        actions={
          ctx.permissions.has('coupons.create') && (
            <Link href="/coupons/new" className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#0B5D3B] px-3 text-xs font-bold text-white hover:bg-[#094D31]">
              <Plus className="h-3.5 w-3.5" /> New coupon
            </Link>
          )
        }
      />
      <FilterBar
        placeholder="Code or title…"
        selects={[
          {
            name: 'status',
            label: 'Any status',
            options: [
              { value: 'live', label: 'Live' },
              { value: 'scheduled', label: 'Scheduled' },
              { value: 'expired', label: 'Expired' },
              { value: 'inactive', label: 'Inactive' },
            ],
          },
        ]}
      />
      <Panel>
        <Table minWidth={900}>
          <THead>
            <Th>Code</Th>
            <Th>Discount</Th>
            <Th>Validity</Th>
            <Th className="text-right">Issued</Th>
            <Th className="text-right">Redeemed</Th>
            <Th className="text-right">Discount given</Th>
            <Th>Status</Th>
          </THead>
          <TBody>
            {data.items.length === 0 && <TableEmpty colSpan={7} title="No coupons" description="Create a coupon to offer a discount." />}
            {data.items.map((c) => {
              const s = couponState(c);
              return (
                <tr key={c.id} className="hover:bg-gray-50/60">
                  <Td>
                    <Link href={`/coupons/${c.id}`} className="font-mono text-[11px] font-bold text-gray-900 hover:text-[#E66E00]">
                      {c.code}
                    </Link>
                    <p className="max-w-[14rem] truncate text-[10px] text-gray-500">{c.title}</p>
                    <p className="text-[10px] text-gray-400">
                      {c.autoIssueOnSignup ? 'Auto-issued at sign-up' : c.requiresGrant ? 'Issued customers only' : 'Anyone with the code'}
                      {c._count.products + c._count.categories > 0 ? ' · selected items' : ''}
                    </p>
                  </Td>
                  <Td className="whitespace-nowrap">
                    <p className="font-bold text-gray-900">{c.discountType === 'FIXED' ? formatINR(c.discountValue) : `${c.discountValue / 100}%`} off</p>
                    <p className="text-[10px] text-gray-400">
                      {c.minOrderValuePaise > 0 ? `min ${formatINR(c.minOrderValuePaise)}` : 'no minimum'}
                      {c.maxDiscountPaise != null ? ` · max ${formatINR(c.maxDiscountPaise)}` : ''}
                    </p>
                  </Td>
                  <Td className="whitespace-nowrap text-gray-600">
                    {when(c.startsAt)} → {when(c.endsAt)}
                  </Td>
                  <Td className="text-right tabular-nums">{c.issuedCount}</Td>
                  <Td className="text-right tabular-nums">
                    {c.redeemedCount}
                    {c.usageLimit != null && <span className="text-gray-400"> / {c.usageLimit}</span>}
                  </Td>
                  <Td className="text-right tabular-nums">{formatINR(c.discountGivenPaise)}</Td>
                  <Td>
                    <StatusBadge status={s.status} label={s.label} />
                  </Td>
                </tr>
              );
            })}
          </TBody>
        </Table>
        <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/coupons" params={searchParams} />
      </Panel>
    </div>
  );
}
