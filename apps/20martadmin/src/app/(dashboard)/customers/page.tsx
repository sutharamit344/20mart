import { listCustomers } from '@20mart/server';
import { requireAdminPage } from '@20mart/server/next';
import { AccessDenied, formatINR, PageHeader, Pagination, Panel, StatusBadge, Table, TableEmpty, TBody, Td, Th, THead } from '../../../components/ui';
import { FilterBar } from '../../../components/FilterBar';

export default async function CustomersPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const ctx = await requireAdminPage();
  if (!ctx.permissions.has('customers.view')) return <AccessDenied permission="customers.view" />;
  const data = await listCustomers(searchParams);
  return (
    <div className="space-y-3 sm:space-y-4">
      <PageHeader title="Customers" description="Accounts created through Google sign-in. Spend counts only paid orders." />
      <FilterBar placeholder="Search name or email…" />
      <Panel>
        <Table minWidth={720}>
          <THead>
            <Th>Customer</Th>
            <Th>Phone</Th>
            <Th className="text-right">Orders</Th>
            <Th className="text-right">Paid spend</Th>
            <Th>Joined</Th>
            <Th>Status</Th>
          </THead>
          <TBody>
            {data.items.length === 0 && <TableEmpty colSpan={6} title="No customers yet" />}
            {data.items.map((c) => (
              <tr key={c.id}>
                <Td>
                  <p className="font-semibold text-gray-900">{c.name ?? '—'}</p>
                  <p className="text-[10px] text-gray-400">{c.email}</p>
                </Td>
                <Td>{c.profile?.phone ? `+91 ${c.profile.phone}` : <span className="text-gray-300">—</span>}</Td>
                <Td className="text-right font-semibold">{c._count.orders}</Td>
                <Td className="text-right font-semibold">{formatINR(c.paidSpendPaise)}</Td>
                <Td className="whitespace-nowrap text-gray-500">{c.createdAt.toLocaleDateString('en-IN', { dateStyle: 'medium' })}</Td>
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
