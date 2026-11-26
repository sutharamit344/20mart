import Link from 'next/link';
import { listPurchaseOrders, poListQuery, supplierOptions, warehouseOptions } from '@20mart/server';
import { requireAdminPage } from '@20mart/server/next';
import { AccessDenied, formatINR, PageHeader, Pagination, Panel, StatusBadge, Table, TableEmpty, TBody, Td, Th, THead } from '../../../components/ui';
import { FilterBar } from '../../../components/FilterBar';

export const dynamic = 'force-dynamic';
const STATUSES = ['DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED'];

export default async function PurchaseOrdersPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  const ctx = await requireAdminPage();
  if (!ctx.permissions.has('purchasing.view')) return <AccessDenied permission="purchasing.view" />;
  const parsed = poListQuery.safeParse(searchParams);
  const [data, suppliers, warehouses] = await Promise.all([
    listPurchaseOrders(parsed.success ? parsed.data : poListQuery.parse({})),
    supplierOptions(),
    warehouseOptions(),
  ]);
  const date = (d: Date) => d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
  return (
    <div className="space-y-3 sm:space-y-4">
      <PageHeader
        title="Purchase orders"
        description="Ordering goods does not change stock. Stock increases only when received goods are confirmed on the order."
        actions={
          ctx.permissions.has('purchasing.manage') ? (
            <Link href="/purchase-orders/new" className="rounded-lg bg-brand-orange px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-orange-600">
              New purchase order
            </Link>
          ) : null
        }
      />
      <FilterBar
        placeholder="Search PO number or supplier…"
        selects={[
          { name: 'status', label: 'All statuses', options: STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ').toLowerCase() })) },
          { name: 'supplierId', label: 'All suppliers', options: suppliers.map((s) => ({ value: s.id, label: s.name })) },
          { name: 'warehouseId', label: 'All warehouses', options: warehouses.map((w) => ({ value: w.id, label: w.code })) },
        ]}
      />
      <Panel>
        <Table minWidth={820}>
          <THead>
            <Th>PO</Th>
            <Th>Supplier</Th>
            <Th>Receive at</Th>
            <Th>Status</Th>
            <Th className="text-right">Received / ordered</Th>
            <Th className="text-right">Value</Th>
            <Th>Expected</Th>
          </THead>
          <TBody>
            {data.items.length === 0 && <TableEmpty colSpan={7} title="No purchase orders" description="Create one to order stock from a supplier." />}
            {data.items.map((po) => (
              <tr key={po.id} className="hover:bg-gray-50/60">
                <Td>
                  <Link href={`/purchase-orders/${po.id}`} className="font-mono font-semibold text-brand-orange-600 hover:underline">
                    {po.poNumber}
                  </Link>
                  <p className="text-[10px] text-gray-400">{date(po.createdAt)}</p>
                </Td>
                <Td className="font-semibold text-gray-900">{po.supplier.name}</Td>
                <Td className="font-mono text-[11px]">{po.warehouse.code}</Td>
                <Td>
                  <StatusBadge status={po.status} />
                </Td>
                <Td className="text-right">
                  {po.received} / {po.ordered}
                  {po.rejected > 0 && <span className="block text-[10px] text-red-600">{po.rejected} rejected</span>}
                </Td>
                <Td className="text-right">{formatINR(po.totalPaise)}</Td>
                <Td>{po.expectedDate ? date(po.expectedDate) : '—'}</Td>
              </tr>
            ))}
          </TBody>
        </Table>
        <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/purchase-orders" params={searchParams} />
      </Panel>
    </div>
  );
}
