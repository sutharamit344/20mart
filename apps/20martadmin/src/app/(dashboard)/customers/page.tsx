import Link from 'next/link';
import { customerListQuery, listCustomersAdmin } from '@20mart/server';
import { requireAdminPage } from '@20mart/server/next';
import { AccessDenied, formatINR, PageHeader, Pagination, Panel, StatusBadge, Table, TableEmpty, TBody, Td, Th, THead } from '../../../components/ui';
import { FilterBar } from '../../../components/FilterBar';

export const dynamic = 'force-dynamic';

const day = (d: Date | null) => (d ? d.toLocaleDateString('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }) : '—');

export default async function CustomersPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  const ctx = await requireAdminPage();
  if (!ctx.permissions.has('customers.view')) return <AccessDenied permission="customers.view" />;
  const parsed = customerListQuery.safeParse(searchParams);
  const data = await listCustomersAdmin(parsed.success ? parsed.data : {});
  return (
    <div className="space-y-3 sm:space-y-4">
      <PageHeader title="Customers" description="Accounts created through Google sign-in. Spend counts only orders whose payment was received." />
      <FilterBar
        placeholder="Name, email or phone…"
        selects={[
          { name: 'status', label: 'Any status', options: [{ value: 'ACTIVE', label: 'Active' }, { value: 'SUSPENDED', label: 'Suspended' }] },
          {
            name: 'segment',
            label: 'All customers',
            options: [
              { value: 'ordered', label: 'Has ordered' },
              { value: 'never_ordered', label: 'Never ordered' },
              { value: 'campaign', label: 'Joined a campaign' },
              { value: 'marketing_opt_in', label: 'Opted in to offers' },
            ],
          },
        ]}
      />
      <Panel>
        <Table minWidth={820}>
          <THead>
            <Th>Customer</Th>
            <Th>Phone</Th>
            <Th className="text-right">Orders</Th>
            <Th className="text-right">Paid spend</Th>
            <Th className="text-right">Coupons used</Th>
            <Th>Joined</Th>
            <Th>Status</Th>
          </THead>
          <TBody>
            {data.items.length === 0 && <TableEmpty colSpan={7} title="No customers found" />}
            {data.items.map((c) => (
              <tr key={c.id} className="hover:bg-surface-muted/60">
                <Td>
                  <Link href={`/customers/${c.id}`} className="font-semibold text-ink hover:text-brand-orange-600">
                    {c.name ?? '—'}
                  </Link>
                  <p className="text-2xs text-ink-400">
                    {c.email}
                    {c._count.campaignJoins > 0 ? ' · campaign' : ''}
                    {c.profile?.marketingOptIn ? ' · offers opt-in' : ''}
                  </p>
                </Td>
                <Td className="text-ink-600">{c.profile?.phone ? `+91 ${c.profile.phone}` : '—'}</Td>
                <Td className="text-right tabular-nums">{c._count.orders}</Td>
                <Td className="text-right tabular-nums">{formatINR(c.paidSpendPaise)}</Td>
                <Td className="text-right tabular-nums">{c._count.redemptions}</Td>
                <Td className="whitespace-nowrap text-ink-500">{day(c.createdAt)}</Td>
                <Td>
                  <StatusBadge status={c.status} />
                </Td>
              </tr>
            ))}
          </TBody>
        </Table>
        <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/customers" params={searchParams} />
      </Panel>
    </div>
  );
}
