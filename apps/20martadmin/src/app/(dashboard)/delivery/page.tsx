import Link from 'next/link';
import { deliveryInterestSummary, getStoreSettings, listPincodes, listZones, onlinePaymentsAvailable } from '@20mart/server';
import { requireAdminPage } from '@20mart/server/next';
import { AccessDenied, PageHeader, Panel } from '../../../components/ui';
import { DeliverySettingsForm, PincodeManager, ZoneManager } from './DeliveryClient';

export const dynamic = 'force-dynamic';

export default async function DeliveryPage(props: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const searchParams = await props.searchParams;
  const ctx = await requireAdminPage();
  if (!ctx.permissions.has('delivery.view')) return <AccessDenied permission="delivery.view" />;
  const canEdit = ctx.permissions.has('delivery.update');
  const [settings, pins, zones, interest] = await Promise.all([
    getStoreSettings(),
    listPincodes({ q: searchParams.q, page: Math.max(1, Number(searchParams.page) || 1), pageSize: 50 }),
    listZones(),
    deliveryInterestSummary(20),
  ]);
  const { updatedAt: _u, updatedById: _b, id: _id, ...editable } = settings;
  const zoneRows = zones.map(({ createdAt: _c, updatedAt: _d, ...z }) => z);
  return (
    <div className="space-y-3 sm:space-y-4">
      <PageHeader
        title="Delivery & payments"
        description={`A PIN code is deliverable only when it is serviceable, belongs to an active delivery area, and that area is mapped to an active warehouse with stock. Nothing is promised elsewhere.${canEdit ? '' : ' Read-only: changing these needs delivery.update.'}`}
      />
      <p className="text-xs text-gray-500">
        Map delivery areas to fulfilment locations on the{' '}
        <Link href="/warehouses" className="font-semibold text-brand-orange-600 hover:underline">
          Warehouses
        </Link>{' '}
        page.
      </p>
      {/* A disabled fieldset makes every control read-only for view-only staff; the API enforces delivery.update too. */}
      <fieldset disabled={!canEdit} className="min-w-0 space-y-3 sm:space-y-4">
        <DeliverySettingsForm initial={editable} onlineConfigured={onlinePaymentsAvailable()} />
        <ZoneManager zones={zoneRows} />
        <PincodeManager items={pins.items.map((p) => ({ ...p, createdAt: undefined, updatedAt: undefined }))} total={pins.total} q={searchParams.q ?? ''} zones={zoneRows} />
      </fieldset>
      <Panel title={`Demand from unserved PIN codes (${interest.total})`} bodyClassName="p-3 sm:p-4">
        {interest.byPincode.length === 0 ? (
          <p className="text-xs text-gray-500">No requests yet. Customers outside delivery areas can ask to be notified; requests are not orders or sales.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5 text-xs">
            {interest.byPincode.map((r) => (
              <span key={r.pincode} className="rounded-full bg-gray-100 px-2.5 py-1">
                <b className="font-mono">{r.pincode}</b> · {r.count} {r.count === 1 ? 'person' : 'people'}
              </span>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
