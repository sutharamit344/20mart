import { redirect } from 'next/navigation';
import { resolveImageSrc } from '@20mart/ui';
import Link from 'next/link';
import Image from 'next/image';
import { formatPaise, PAYMENT_STATUS_LABEL } from '@20mart/shared';
import { listCustomerOrders } from '@20mart/server';
import { getCurrentCustomer } from '@20mart/server/next';
import { ChevronRight, ShoppingBag } from 'lucide-react';
import { AccountLayout } from '../../../components/AccountLayout';

export const dynamic = 'force-dynamic';

const tone = (s: string) =>
  s === 'DELIVERED' ? 'bg-success-soft text-success' : s === 'CANCELLED' || s === 'FAILED' ? 'bg-danger-soft text-danger' : 'bg-brand-orange-50 text-brand-orange-600';

export default async function MyOrdersPage(props: { searchParams: Promise<{ page?: string }> }) {
  const searchParams = await props.searchParams;
  const customer = await getCurrentCustomer();
  if (!customer) redirect('/auth?returnTo=/account'); // layout and page render concurrently
  const page = Math.max(1, Number(searchParams.page) || 1);
  const data = await listCustomerOrders(customer.id, page, 10);
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <AccountLayout title="My Orders" subtitle="Your order history and status." activeKey="orders">
      {data.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface p-10 text-center">
          <ShoppingBag className="mx-auto mb-2 h-8 w-8 text-ink-400" />
          <p className="text-sm font-bold text-ink">No orders yet</p>
          <Link href="/shop" className="mt-3 inline-flex h-9 items-center rounded-xl bg-brand-orange px-4 text-xs font-bold text-white">
            Start shopping
          </Link>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {data.items.map((o) => (
            <li key={o.orderNumber}>
              <Link href={`/account/orders/${o.orderNumber}`} className="block rounded-2xl border border-line-subtle bg-surface p-3 hover:border-brand-orange-200">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-ink">#{o.orderNumber}</p>
                    <p className="text-2xs text-ink-500">
                      {new Date(o.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' })} · {o._count.items} item{o._count.items === 1 ? '' : 's'}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-2xs font-bold ${tone(o.status)}`}>{o.statusLabel}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex -space-x-2">
                    {o.items.map((it, i) => (
                      <div key={i} className="relative h-9 w-9 overflow-hidden rounded-lg border-2 border-white bg-surface-page">
                        {it.productImage ? <Image src={resolveImageSrc(it.productImage)} alt="" fill sizes="36px" className="object-contain" /> : null}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 text-right">
                    <div>
                      <p className="text-sm font-bold text-ink">{formatPaise(o.totalPaise)}</p>
                      <p className="text-2xs text-ink-500">{PAYMENT_STATUS_LABEL[o.paymentStatus]}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-ink-400" />
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-between text-xs">
          {page > 1 ? <Link href={`/account/orders?page=${page - 1}`} className="font-bold text-brand-orange">← Newer</Link> : <span />}
          <span className="text-ink-500">Page {page} of {pages}</span>
          {page < pages ? <Link href={`/account/orders?page=${page + 1}`} className="font-bold text-brand-orange">Older →</Link> : <span />}
        </div>
      )}
    </AccountLayout>
  );
}
