import { getStoreSettings, listPincodes, onlinePaymentsAvailable } from '@20mart/server';
import { requireAdminPage } from '@20mart/server/next';
import { AccessDenied, PageHeader } from '../../../components/ui';
import { DeliverySettingsForm, PincodeManager } from './DeliveryClient';

export default async function DeliveryPage({ searchParams }: { searchParams: { q?: string; page?: string } }) {
  const ctx = await requireAdminPage();
  if (!ctx.permissions.has('delivery.manage')) return <AccessDenied permission="delivery.manage" />;
  const [settings, pins] = await Promise.all([
    getStoreSettings(),
    listPincodes({ q: searchParams.q, page: Math.max(1, Number(searchParams.page) || 1), pageSize: 50 }),
  ]);
  const { updatedAt: _u, updatedById: _b, id: _id, ...editable } = settings;
  return (
    <div className="space-y-3 sm:space-y-4">
      <PageHeader title="Delivery & payments" description="Only listed, serviceable PIN codes can order. Nothing is promised for unlisted areas." />
      <DeliverySettingsForm initial={editable} onlineConfigured={onlinePaymentsAvailable()} />
      <PincodeManager items={pins.items.map((p) => ({ ...p, createdAt: undefined, updatedAt: undefined }))} total={pins.total} q={searchParams.q ?? ''} />
    </div>
  );
}
