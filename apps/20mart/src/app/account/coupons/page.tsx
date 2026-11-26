import { redirect } from 'next/navigation';
import Link from 'next/link';
import { formatPaise } from '@20mart/shared';
import { listCustomerCoupons } from '@20mart/server';
import { getCurrentCustomer } from '@20mart/server/next';
import { Tag } from 'lucide-react';
import { AccountLayout } from '../../../components/AccountLayout';

export const dynamic = 'force-dynamic';

const STATE: Record<string, { label: string; cls: string }> = {
  AVAILABLE: { label: 'Available', cls: 'bg-emerald-50 text-emerald-700' },
  UPCOMING: { label: 'Starts soon', cls: 'bg-sky-50 text-sky-700' },
  USED: { label: 'Used', cls: 'bg-gray-100 text-gray-500' },
  EXPIRED: { label: 'Expired', cls: 'bg-gray-100 text-gray-500' },
  UNAVAILABLE: { label: 'Not active yet', cls: 'bg-amber-50 text-amber-700' },
};

const date = (d: Date) => d.toLocaleDateString('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' });

export default async function MyCouponsPage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect('/auth?returnTo=/account'); // layout and page render concurrently
  const { items } = await listCustomerCoupons(customer.id);
  const order = ['AVAILABLE', 'UPCOMING', 'UNAVAILABLE', 'USED', 'EXPIRED'];
  const sorted = [...items].sort((a, b) => order.indexOf(a.state) - order.indexOf(b.state));
  return (
    <AccountLayout title="My coupons" subtitle="Coupons issued to you and offers open to everyone. Apply a code in your cart.">
      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-center">
          <Tag className="mx-auto h-6 w-6 text-gray-300" />
          <p className="mt-2 text-sm font-bold text-gray-900">No coupons right now</p>
          <p className="mt-0.5 text-xs text-gray-500">When you receive a coupon it will appear here.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {sorted.map((c) => {
            const s = STATE[c.state];
            const off = c.discountType === 'FIXED' ? formatPaise(c.discountValue) : `${c.discountValue / 100}%`;
            const usable = c.state === 'AVAILABLE';
            return (
              <li key={c.id} className={`rounded-2xl border bg-white p-3.5 shadow-xs ${usable ? 'border-emerald-100' : 'border-gray-100 opacity-80'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-lg font-black text-gray-900">{off} off</p>
                    <p className="text-xs font-semibold text-gray-700">{c.title}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${s.cls}`}>{s.label}</span>
                </div>
                <p className="mt-2 inline-block rounded-lg border border-dashed border-brand-green/40 bg-brand-green/5 px-2.5 py-1 font-mono text-sm font-bold tracking-wider text-brand-green">{c.code}</p>
                <ul className="mt-2 space-y-0.5 text-[11px] text-gray-500">
                  {c.minOrderValuePaise > 0 && <li>On orders of {formatPaise(c.minOrderValuePaise)} or more</li>}
                  {c.maxDiscountPaise != null && <li>Maximum discount {formatPaise(c.maxDiscountPaise)}</li>}
                  {c.perCustomerLimit > 1 && <li>Use up to {c.perCustomerLimit} times</li>}
                  {c.endsAt && <li>{c.state === 'EXPIRED' ? 'Expired' : 'Valid until'} {date(c.endsAt)}</li>}
                  {c.state === 'UPCOMING' && <li>Starts {date(c.startsAt)}</li>}
                  {c.description && <li>{c.description}</li>}
                </ul>
                {usable && (
                  <Link href="/cart" className="mt-2.5 inline-flex h-8 items-center rounded-lg bg-brand-green px-3 text-[11px] font-bold text-white hover:bg-brand-green-hover">
                    Use in cart
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </AccountLayout>
  );
}
