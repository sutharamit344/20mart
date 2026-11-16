import { notFound } from 'next/navigation';
import { getPurchaseOrder, supplierOptions, warehouseOptions, toAppError } from '@20mart/server';
import { requireAdminPage } from '@20mart/server/next';
import { AccessDenied, PageHeader, StatusBadge } from '../../../../components/ui';
import { PoDetail } from '../PoDetail';
import { PoEditor } from '../PoEditor';

export const dynamic = 'force-dynamic';

export default async function PurchaseOrderPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const ctx = await requireAdminPage();
  if (!ctx.permissions.has('purchasing.view')) return <AccessDenied permission="purchasing.view" />;
  const po = await getPurchaseOrder(params.id).catch((e) => {
    const status = toAppError(e).status;
    if (status === 404 || status === 400) return null;
    throw e;
  });
  if (!po) notFound();
  const canManage = ctx.permissions.has('purchasing.manage');
  const editable = po.status === 'DRAFT' && canManage;
  const [suppliers, warehouses] = editable ? await Promise.all([supplierOptions(), warehouseOptions()]) : [[], []];
  return (
    <div className="space-y-3 sm:space-y-4">
      <PageHeader
        title={`Purchase order ${po.poNumber}`}
        description={`${po.supplier.name} → ${po.warehouse.code} · ${po.warehouse.name}`}
        actions={<StatusBadge status={po.status} />}
      />
      <PoDetail po={JSON.parse(JSON.stringify(po))} perms={{ manage: canManage, receive: ctx.permissions.has('purchasing.receive') }} />
      {editable && (
        <PoEditor
          suppliers={suppliers}
          warehouses={warehouses.filter((w) => w.status !== 'INACTIVE')}
          existing={{
            id: po.id,
            supplierId: po.supplierId,
            warehouseId: po.warehouseId,
            expectedDate: po.expectedDate ? po.expectedDate.toISOString().slice(0, 10) : '',
            notes: po.notes ?? '',
            items: po.items.map((i) => ({
              productId: i.productId,
              variantId: i.variantId,
              label: i.variant ? `${i.product.name} · ${i.variant.name}` : i.product.name,
              sku: i.variant?.sku ?? i.product.sku,
              quantity: String(i.quantityOrdered),
              unitCost: (i.unitCostPaise / 100).toFixed(2),
            })),
          }}
        />
      )}
    </div>
  );
}
