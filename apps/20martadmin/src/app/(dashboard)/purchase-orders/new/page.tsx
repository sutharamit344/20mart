import { supplierOptions, warehouseOptions } from '@20mart/server';
import { requireAdminPage } from '@20mart/server/next';
import { AccessDenied, PageHeader } from '../../../../components/ui';
import { PoEditor } from '../PoEditor';

export default async function NewPurchaseOrderPage() {
  const ctx = await requireAdminPage();
  if (!ctx.permissions.has('purchasing.manage')) return <AccessDenied permission="purchasing.manage" />;
  const [suppliers, warehouses] = await Promise.all([supplierOptions(), warehouseOptions()]);
  return (
    <div className="space-y-3 sm:space-y-4">
      <PageHeader title="New purchase order" description="Saved as a draft. Mark it as ordered when it is sent to the supplier." />
      <PoEditor suppliers={suppliers} warehouses={warehouses.filter((w) => w.status !== 'INACTIVE')} />
    </div>
  );
}
