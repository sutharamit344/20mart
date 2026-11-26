import { listMovements, movementListQuery, warehouseOptions } from '@20mart/server';
import { requireAdminPage } from '@20mart/server/next';
import { AccessDenied, PageHeader, Pagination, Panel, StatusBadge, Table, TableEmpty, TBody, Td, Th, THead } from '../../../../components/ui';
import { FilterBar } from '../../../../components/FilterBar';

const TYPES = ['INITIAL_STOCK', 'STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT', 'PURCHASE_RECEIPT', 'RESERVATION', 'RELEASE', 'SALE'];
const label = (t: string) => t.replace(/_/g, ' ').toLowerCase();

/** Immutable stock ledger across warehouses. */
export default async function MovementsPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  const ctx = await requireAdminPage();
  if (!ctx.permissions.has('inventory.view')) return <AccessDenied permission="inventory.view" />;
  const parsed = movementListQuery.safeParse({ pageSize: 30, ...searchParams });
  const query = parsed.success ? parsed.data : movementListQuery.parse({ pageSize: 30 });
  const [data, warehouses] = await Promise.all([listMovements(query), warehouseOptions()]);
  return (
    <div className="space-y-3 sm:space-y-4">
      <PageHeader
        title="Stock movements"
        description="Every received, sold, reserved, released and corrected unit. Entries are never edited; mistakes are fixed with a new correction."
      />
      <FilterBar
        placeholder="Search product, SKU or reference…"
        selects={[
          { name: 'warehouseId', label: 'All warehouses', options: warehouses.map((w) => ({ value: w.id, label: `${w.code} · ${w.name}` })) },
          { name: 'type', label: 'All movement types', options: TYPES.map((t) => ({ value: t, label: label(t) })) },
        ]}
      />
      <Panel>
        <Table minWidth={900}>
          <THead>
            <Th>When</Th>
            <Th>Warehouse</Th>
            <Th>Item</Th>
            <Th>Type</Th>
            <Th className="text-right">Change</Th>
            <Th className="text-right">Before → after</Th>
            <Th>Reason / reference</Th>
            <Th>By</Th>
          </THead>
          <TBody>
            {data.items.length === 0 && <TableEmpty colSpan={8} title="No stock movements" description="Nothing matches these filters yet." />}
            {data.items.map((m) => (
              <tr key={m.id}>
                <Td className="whitespace-nowrap text-ink-500">{m.createdAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })}</Td>
                <Td className="font-mono text-2xs">{m.inventory.warehouse.code}</Td>
                <Td>
                  <p className="font-semibold text-ink">
                    {m.inventory.product.name}
                    {m.inventory.variant && <span className="font-normal text-ink-500"> · {m.inventory.variant.name}</span>}
                  </p>
                  <p className="font-mono text-2xs text-ink-400">{m.inventory.variant?.sku ?? m.inventory.product.sku}</p>
                </Td>
                <Td>
                  <StatusBadge status={m.movementType} label={label(m.movementType)} />
                </Td>
                <Td className={`text-right font-bold ${m.quantity >= 0 ? 'text-success' : 'text-danger'}`}>
                  {m.quantity > 0 ? '+' : ''}
                  {m.quantity}
                </Td>
                <Td className="text-right text-ink-500">
                  {m.previousQuantity} → {m.newQuantity}
                  {(m.movementType === 'RESERVATION' || m.movementType === 'RELEASE') && <span className="block text-2xs">reserved</span>}
                </Td>
                <Td className="max-w-[18rem]">
                  <p className="truncate">{m.reason}</p>
                  {m.reference && <p className="font-mono text-2xs text-ink-400">{m.reference}</p>}
                </Td>
                <Td className="text-ink-500">{m.performedBy?.name ?? 'System'}</Td>
              </tr>
            ))}
          </TBody>
        </Table>
        <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/inventory/movements" params={searchParams} />
      </Panel>
    </div>
  );
}
