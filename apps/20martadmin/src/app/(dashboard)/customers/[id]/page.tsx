import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppError, getCustomerAdmin, orderStatusLabel } from '@20mart/server';
import { requireAdminPage } from '@20mart/server/next';
import { AccessDenied, formatINR, PageHeader, Panel, StatCard, StatusBadge, Table, TableEmpty, TBody, Td, Th, THead } from '../../../../components/ui';
import { CustomerStatus } from './CustomerStatus';

export const dynamic = 'force-dynamic';

const day = (d: Date | null) => (d ? d.toLocaleDateString('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }) : '—');

export default async function CustomerDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const ctx = await requireAdminPage();
  if (!ctx.permissions.has('customers.view')) return <AccessDenied permission="customers.view" />;
  const canOrders = ctx.permissions.has('orders.view');
  let c: Awaited<ReturnType<typeof getCustomerAdmin>>;
  try {
    c = await getCustomerAdmin(params.id, { includeAddresses: canOrders, includeOrders: canOrders });
  } catch (e) {
    if (e instanceof AppError || (e as Error).name === 'ZodError') notFound();
    throw e;
  }
  return (
    <div className="space-y-3 sm:space-y-4">
      <PageHeader
        title={c.name ?? c.email ?? 'Customer'}
        description={`${c.email ?? ''} · joined ${day(c.createdAt)} · last sign-in ${day(c.lastLoginAt)}`}
        actions={
          <>
            <StatusBadge status={c.status} />
            {ctx.permissions.has('customers.update') && <CustomerStatus id={c.id} status={c.status} />}
          </>
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <StatCard label="Orders" value={c._count.orders} hint={`${c.paidOrders} paid`} />
        <StatCard label="Paid spend" value={formatINR(c.paidSpendPaise)} tone="green" />
        <StatCard label="Coupons issued" value={c.couponGrants.length} hint={`${c.redemptions.filter((r) => r.status === 'APPLIED').length} redeemed`} />
        <StatCard label="Campaigns joined" value={c.campaigns.length} hint={c.profile?.marketingOptIn ? 'Opted in to offer emails' : 'No offer emails'} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
        <Panel title="Profile" bodyClassName="p-3 text-xs space-y-1">
          <p>
            <span className="text-ink-500">Phone:</span> {c.profile?.phone ? `+91 ${c.profile.phone}` : '—'}
          </p>
          <p>
            <span className="text-ink-500">Email verified:</span> {c.emailVerified ? 'Yes (Google)' : 'No'}
          </p>
          <p>
            <span className="text-ink-500">Order emails:</span> {c.profile?.emailOrderUpdates === false ? 'Off' : 'On'} · <span className="text-ink-500">Offer emails:</span> {c.profile?.marketingOptIn ? 'On' : 'Off'}
          </p>
          <p>
            <span className="text-ink-500">Wishlist items:</span> {c._count.wishlist}
          </p>
        </Panel>
        <Panel title="Addresses" bodyClassName="p-3 text-xs">
          {c.addresses == null ? (
            <p className="text-ink-500">Addresses are visible to staff with order access (orders.view).</p>
          ) : c.addresses.length === 0 ? (
            <p className="text-ink-500">No saved addresses.</p>
          ) : (
            <ul className="space-y-2">
              {c.addresses.map((a) => (
                <li key={a.id} className="rounded-lg bg-surface-page p-2">
                  <p className="font-semibold text-ink">
                    {a.name} · +91 {a.phone} {a.isDefault && <span className="text-2xs text-brand-green">(default)</span>}
                  </p>
                  <p className="text-ink-600">
                    {[a.addressLine1, a.addressLine2, a.landmark, a.city, a.state].filter(Boolean).join(', ')} — {a.pincode}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {c.orders && (
        <Panel title="Recent orders">
          <Table minWidth={620}>
            <THead>
              <Th>Order</Th>
              <Th>Placed</Th>
              <Th className="text-right">Total</Th>
              <Th>Payment</Th>
              <Th>Status</Th>
            </THead>
            <TBody>
              {c.orders.length === 0 && <TableEmpty colSpan={5} title="No orders yet" />}
              {c.orders.map((o) => (
                <tr key={o.id}>
                  <Td>
                    <Link href={`/orders/${o.id}`} className="font-mono text-2xs font-bold hover:text-brand-orange-600">
                      {o.orderNumber}
                    </Link>
                    {o.couponCode && <p className="text-2xs text-ink-400">Coupon {o.couponCode}</p>}
                  </Td>
                  <Td className="text-ink-500">{day(o.createdAt)}</Td>
                  <Td className="text-right tabular-nums">{formatINR(o.totalPaise)}</Td>
                  <Td>{o.paymentStatus.charAt(0) + o.paymentStatus.slice(1).toLowerCase().replace(/_/g, ' ')}</Td>
                  <Td>{orderStatusLabel(o.status)}</Td>
                </tr>
              ))}
            </TBody>
          </Table>
        </Panel>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
        <Panel title="Coupons">
          <Table minWidth={420}>
            <THead>
              <Th>Coupon</Th>
              <Th>Issued</Th>
              <Th>Source</Th>
            </THead>
            <TBody>
              {c.couponGrants.length === 0 && <TableEmpty colSpan={3} title="No coupons issued" />}
              {c.couponGrants.map((g) => (
                <tr key={g.coupon.id}>
                  <Td className="font-mono text-2xs font-bold">{g.coupon.code}</Td>
                  <Td className="text-ink-500">{day(g.issuedAt)}</Td>
                  <Td>{g.source.charAt(0) + g.source.slice(1).toLowerCase()}</Td>
                </tr>
              ))}
            </TBody>
          </Table>
          {c.redemptions.length > 0 && (
            <div className="border-t border-line-subtle p-3 text-xs">
              <p className="mb-1 font-bold text-ink-700">Redemptions</p>
              <ul className="space-y-0.5">
                {c.redemptions.map((r) => (
                  <li key={r.id} className="flex justify-between gap-2">
                    <span>
                      <span className="font-mono">{r.coupon.code}</span> on <span className="font-mono">{r.order.orderNumber}</span>
                    </span>
                    <span className={r.status === 'REVERSED' ? 'text-ink-400 line-through' : 'font-semibold'}>{formatINR(r.discountPaise)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
        <Panel title="Campaign participation (interest, not purchases)">
          <Table minWidth={380}>
            <THead>
              <Th>Campaign</Th>
              <Th>Joined</Th>
              <Th className="text-right">Units saved</Th>
            </THead>
            <TBody>
              {c.campaigns.length === 0 && <TableEmpty colSpan={3} title="No campaigns joined" />}
              {c.campaigns.map((x) => (
                <tr key={x.campaign.id}>
                  <Td>
                    {ctx.permissions.has('campaigns.view') ? (
                      <Link href={`/campaigns/${x.campaign.id}`} className="font-semibold hover:text-brand-orange-600">
                        {x.campaign.name}
                      </Link>
                    ) : (
                      x.campaign.name
                    )}
                  </Td>
                  <Td className="text-ink-500">{day(x.joinedAt)}</Td>
                  <Td className="text-right tabular-nums">{x.savedUnits}</Td>
                </tr>
              ))}
            </TBody>
          </Table>
        </Panel>
      </div>
    </div>
  );
}
