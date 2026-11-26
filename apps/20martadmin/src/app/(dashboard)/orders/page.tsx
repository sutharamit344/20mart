import Link from 'next/link';
import { adminOrderListQuery, listAdminOrders, orderStatusLabel, warehouseOptions } from '@20mart/server';
import { requireAdminPage } from '@20mart/server/next';
import { AccessDenied, formatINR, PageHeader, Pagination, Panel, StatusBadge, Table, TableEmpty, TBody, Td, Th, THead } from '../../../components/ui';
import { FilterBar } from '../../../components/FilterBar';
import { DateRange } from './DateRange';

const STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'READY_FOR_DISPATCH', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'FAILED'] as const;
const PAYMENTS = ['PENDING', 'PAID', 'FAILED', 'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED'] as const;
const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');

export default async function OrdersPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  const ctx = await requireAdminPage();
  if (!ctx.permissions.has('orders.view')) return <AccessDenied permission="orders.view" />;
  const parsed = adminOrderListQuery.safeParse(searchParams);
  const [data, warehouses] = await Promise.all([listAdminOrders(parsed.success ? parsed.data : {}), warehouseOptions()]);

  return (
    <div className="space-y-3 sm:space-y-4">
      <PageHeader title="Orders" description="Real customer orders. Stock is reserved at placement and committed on confirmation." />
      <FilterBar
        placeholder="Order no., customer, phone or PIN…"
        selects={[
          { name: 'status', label: 'Any status', options: STATUSES.map((s) => ({ value: s, label: orderStatusLabel(s) })) },
          { name: 'paymentStatus', label: 'Any payment', options: PAYMENTS.map((s) => ({ value: s, label: label(s) })) },
          ...(warehouses.length > 1 ? [{ name: 'warehouseId', label: 'Any warehouse', options: warehouses.map((w) => ({ value: w.id, label: w.code })) }] : []),
        ]}
      >
        <DateRange />
      </FilterBar>
      <Panel>
        <Table minWidth={860}>
          <THead>
            <Th>Order</Th>
            <Th>Customer</Th>
            <Th>Placed</Th>
            <Th className="text-right">Total</Th>
            <Th>Payment</Th>
            <Th>Status</Th>
            <Th>PIN / WH</Th>
          </THead>
          <TBody>
            {data.items.length === 0 && <TableEmpty colSpan={7} title="No orders found" description="Orders placed on the storefront appear here." />}
            {data.items.map((o) => (
              <tr key={o.id} className="hover:bg-surface-muted/60">
                <Td>
                  <Link href={`/orders/${o.id}`} className="font-mono text-2xs font-bold text-ink hover:text-brand-orange-600">
                    {o.orderNumber}
                  </Link>
                  <p className="text-2xs text-ink-400">
                    {o._count.items} item{o._count.items === 1 ? '' : 's'} · {o.paymentMethod === 'CASH_ON_DELIVERY' ? 'COD' : 'Online'}
                  </p>
                </Td>
                <Td>
                  <p className="font-semibold text-ink-800">{o.user.name ?? o.shipName}</p>
                  <p className="text-2xs text-ink-400">{o.user.email}</p>
                </Td>
                <Td className="whitespace-nowrap text-ink-500">{o.createdAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })}</Td>
                <Td className="text-right font-bold text-ink">{formatINR(o.totalPaise)}</Td>
                <Td>
                  <StatusBadge status={o.paymentStatus === 'PAID' ? 'ACTIVE' : o.paymentStatus === 'FAILED' ? 'OUT' : o.paymentStatus.includes('REFUND') ? 'LOW' : 'DRAFT'} label={label(o.paymentStatus)} />
                </Td>
                <Td>
                  <StatusBadge status={o.status === 'DELIVERED' ? 'ACTIVE' : o.status === 'CANCELLED' || o.status === 'FAILED' ? 'OUT' : 'FEATURED'} label={orderStatusLabel(o.status)} />
                </Td>
                <Td className="font-mono text-2xs">
                  {o.shipPincode}
                  {o.fulfillmentWarehouse && <span className="block text-2xs text-ink-400">{o.fulfillmentWarehouse.code}</span>}
                </Td>
              </tr>
            ))}
          </TBody>
        </Table>
        <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/orders" params={searchParams} />
      </Panel>
    </div>
  );
}
