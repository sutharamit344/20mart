import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { resolveImageSrc } from '@20mart/ui';
import { getAdminOrder, orderStatusLabel } from '@20mart/server';
import { requireAdminPage } from '@20mart/server/next';
import { AccessDenied, formatINR, Panel, StatusBadge } from '../../../../components/ui';
import { OrderActions } from './OrderActions';

const dt = (d: Date) => d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');

export default async function AdminOrderPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const ctx = await requireAdminPage();
  if (!ctx.permissions.has('orders.view')) return <AccessDenied permission="orders.view" />;
  const o = await getAdminOrder(params.id).catch(() => null);
  if (!o) notFound();
  const can = (p: string) => ctx.permissions.has(p);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/orders" className="rounded-lg p-1.5 text-ink-500 hover:bg-surface-muted" aria-label="Back to orders">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="font-mono text-base sm:text-lg font-extrabold text-ink">{o.orderNumber}</h1>
        <StatusBadge status={o.status === 'DELIVERED' ? 'ACTIVE' : o.status === 'CANCELLED' || o.status === 'FAILED' ? 'OUT' : 'FEATURED'} label={orderStatusLabel(o.status)} />
        <StatusBadge status={o.paymentStatus === 'PAID' ? 'ACTIVE' : 'DRAFT'} label={label(o.paymentStatus)} />
        <span className="text-xs text-ink-500">{dt(o.createdAt)}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 items-start">
        <div className="lg:col-span-2 space-y-3 sm:space-y-4 min-w-0">
          <Panel title={`Items (${o.items.length})`}>
            <ul className="divide-y divide-line-subtle">
              {o.items.map((it) => (
                <li key={it.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-line-subtle bg-surface">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {it.productImage && <img src={resolveImageSrc(it.productImage)} alt="" className="h-full w-full object-contain" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">
                      {it.productName}
                      {it.variantName && <span className="font-normal text-ink-500"> · {it.variantName}</span>}
                    </p>
                    <p className="font-mono text-2xs text-ink-400">
                      {it.productSku}
                      {it.brandName ? ` · ${it.brandName}` : ''}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-ink-600">
                    {it.quantity} × {formatINR(it.unitPricePaise)}
                  </span>
                  <span className="w-16 text-right font-bold text-ink">{formatINR(it.totalPricePaise)}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-1 border-t border-line-subtle px-4 py-2.5 text-xs">
              <div className="flex justify-between"><dt className="text-ink-500">Subtotal</dt><dd>{formatINR(o.subtotalPaise)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Delivery</dt><dd>{o.deliveryChargePaise ? formatINR(o.deliveryChargePaise) : 'Free'}</dd></div>
              <div className="flex justify-between text-sm font-extrabold text-ink"><dt>Total</dt><dd>{formatINR(o.totalPaise)}</dd></div>
            </dl>
          </Panel>

          <Panel title="Payments & refunds" bodyClassName="p-4 space-y-2 text-xs">
            {o.payments.length === 0 && <p className="text-ink-500">No payment attempts yet.</p>}
            {o.payments.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-page p-2">
                <span className="font-semibold text-ink-800">
                  #{p.attempt} · {p.provider} · {formatINR(p.amountPaise)}
                </span>
                <span className="font-mono text-2xs text-ink-500">{p.providerPaymentId ?? p.providerOrderId ?? '—'}</span>
                <StatusBadge status={p.status === 'PAID' ? 'ACTIVE' : p.status === 'FAILED' ? 'OUT' : 'DRAFT'} label={label(p.status)} />
                {p.failureReason && <p className="w-full text-2xs text-danger">{p.failureReason}</p>}
              </div>
            ))}
            {o.refunds.length > 0 && <p className="pt-1 font-bold text-ink-700">Refunds</p>}
            <OrderActions
              mode="refunds"
              orderId={o.id}
              refunds={o.refunds.map((r) => ({ id: r.id, status: r.status, provider: r.provider, amountPaise: r.amountPaise, reason: r.reason, reference: r.reference, failureReason: r.failureReason, by: r.initiatedBy?.name ?? null }))}
              perms={{ update: can('orders.update'), cancel: can('orders.cancel'), refund: can('orders.refund') }}
            />
          </Panel>

          <Panel title="Status history" bodyClassName="p-4">
            <ol className="space-y-2 text-xs">
              {o.history.map((h) => (
                <li key={h.id} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-semibold text-ink">
                    {h.fromStatus ? `${orderStatusLabel(h.fromStatus)} → ` : ''}
                    {orderStatusLabel(h.toStatus)}
                  </span>
                  <span className="text-ink-500">by {h.changedByAdmin?.name ?? h.actor}</span>
                  <span className="text-2xs text-ink-400">{dt(h.createdAt)}</span>
                  {h.reason && <span className="w-full text-ink-600">“{h.reason}”</span>}
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="space-y-3 sm:space-y-4 min-w-0">
          <Panel title="Actions" bodyClassName="p-4">
            <OrderActions
              mode="status"
              orderId={o.id}
              status={o.status}
              nextStatus={o.nextStatus}
              nextLabel={o.nextStatus ? orderStatusLabel(o.nextStatus) : null}
              paymentMethod={o.paymentMethod}
              paymentStatus={o.paymentStatus}
              perms={{ update: can('orders.update'), cancel: can('orders.cancel'), refund: can('orders.refund') }}
            />
          </Panel>
          <Panel title="Customer" bodyClassName="p-4 text-xs space-y-0.5">
            <p className="font-semibold text-ink">{o.user.name ?? '—'}</p>
            <p className="text-ink-600">{o.user.email}</p>
            {o.user.profile?.phone && <p className="text-ink-600">+91 {o.user.profile.phone}</p>}
            <p className="text-2xs text-ink-400">{o.user._count.orders} order(s) · customer since {o.user.createdAt.toLocaleDateString('en-IN')}</p>
          </Panel>
          <Panel title="Delivery address (snapshot)" bodyClassName="p-4 text-xs space-y-0.5">
            <p className="font-semibold text-ink">{o.shipName}</p>
            <p className="text-ink-600">
              {o.shipLine1}
              {o.shipLine2 ? `, ${o.shipLine2}` : ''}
              {o.shipLandmark ? `, near ${o.shipLandmark}` : ''}
            </p>
            <p className="text-ink-600">
              {o.shipCity}, {o.shipState} – <b>{o.shipPincode}</b>
            </p>
            <p className="text-ink-600">+91 {o.shipPhone}</p>
            {o.deliveryEstimate && <p className="pt-1 text-2xs text-success">{o.deliveryEstimate}</p>}
            <p className="pt-1 text-2xs text-ink-600">
              Fulfilment warehouse:{' '}
              {o.fulfillmentWarehouse ? (
                <b>
                  {o.fulfillmentWarehouse.code} · {o.fulfillmentWarehouse.name}
                </b>
              ) : (
                <span className="text-ink-400">not recorded</span>
              )}
            </p>
            {o.dispatchedAt && <p className="text-2xs text-ink-500">Dispatched {o.dispatchedAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })}</p>}
            {o.deliveredAt && <p className="text-2xs text-ink-500">Delivered {o.deliveredAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })}</p>}
            {o.deliveryFailureReason && <p className="text-2xs font-semibold text-danger">Delivery failed: {o.deliveryFailureReason}</p>}
            {o.notes && <p className="pt-1 text-2xs text-ink-500">Customer note: {o.notes}</p>}
          </Panel>
          <Panel title="Internal notes" bodyClassName="p-4">
            <OrderActions
              mode="notes"
              orderId={o.id}
              notes={o.orderNotes.map((n) => ({ id: n.id, note: n.note, by: n.admin?.name ?? 'Admin', at: n.createdAt.toISOString() }))}
              perms={{ update: can('orders.update'), cancel: can('orders.cancel'), refund: can('orders.refund') }}
            />
          </Panel>
        </div>
      </div>
    </div>
  );
}
