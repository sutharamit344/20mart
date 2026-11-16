import { listWarehouses, listZones } from '@20mart/server';
import { requireAdminPage } from '@20mart/server/next';
import { AccessDenied, PageHeader } from '../../../components/ui';
import { WarehousesClient } from './WarehousesClient';

export const dynamic = 'force-dynamic';

export default async function WarehousesPage() {
  const ctx = await requireAdminPage();
  if (!ctx.permissions.has('warehouses.view')) return <AccessDenied permission="warehouses.view" />;
  const [warehouses, zones] = await Promise.all([listWarehouses(), listZones()]);
  return (
    <div className="space-y-3 sm:space-y-4">
      <PageHeader
        title="Warehouses"
        description="Fulfilment locations. A location serves customers only when it is Active, has stock, and is mapped to an active delivery area."
      />
      <WarehousesClient
        warehouses={JSON.parse(JSON.stringify(warehouses))}
        zones={zones.map((z) => ({ id: z.id, name: z.name, isActive: z.isActive, pincodeCount: z.pincodeCount }))}
        perms={{ manage: ctx.permissions.has('warehouses.manage'), mapZones: ctx.permissions.has('warehouses.manage') && ctx.permissions.has('delivery.update') }}
      />
    </div>
  );
}
