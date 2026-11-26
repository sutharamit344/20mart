import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@20mart/database';
import { formatPaise } from '@20mart/shared';
import { getCurrentCustomer } from '@20mart/server/next';
import { orderStatusLabel } from '@20mart/server';
import { Heart, MapPin, Package, Truck } from 'lucide-react';
import { AccountLayout } from '../../components/AccountLayout';

export const dynamic = 'force-dynamic';

export default async function AccountDashboard() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect('/auth?returnTo=/account'); // layout and page render concurrently
  const [orders, active, addresses, wishlist, latest] = await Promise.all([
    prisma.order.count({ where: { userId: customer.id } }),
    prisma.order.count({ where: { userId: customer.id, status: { notIn: ['DELIVERED', 'CANCELLED', 'FAILED'] } } }),
    prisma.address.count({ where: { userId: customer.id } }),
    prisma.wishlistItem.count({ where: { userId: customer.id } }),
    prisma.order.findFirst({
      where: { userId: customer.id },
      orderBy: { createdAt: 'desc' },
      select: { orderNumber: true, status: true, totalPaise: true, createdAt: true },
    }),
  ]);
  const tiles = [
    { label: 'Orders', value: orders, href: '/account/orders', icon: Package },
    { label: 'In progress', value: active, href: '/account/tracking', icon: Truck },
    { label: 'Addresses', value: addresses, href: '/account/addresses', icon: MapPin },
    { label: 'Wishlist', value: wishlist, href: '/account/wishlist', icon: Heart },
  ];
  return (
    <AccountLayout title={`Hi${customer.name ? `, ${customer.name.split(' ')[0]}` : ''}`} subtitle="Manage your orders, addresses and profile.">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className="rounded-2xl border border-line-subtle bg-surface p-3 hover:border-brand-orange-200">
            <t.icon className="h-4 w-4 text-brand-orange" />
            <p className="mt-1.5 text-lg font-bold text-ink">{t.value}</p>
            <p className="text-2xs text-ink-500">{t.label}</p>
          </Link>
        ))}
      </div>
      <div className="mt-3 rounded-2xl border border-line-subtle bg-surface p-3.5 ">
        <h2 className="text-xs font-bold uppercase tracking-wider text-ink-500">Latest order</h2>
        {latest ? (
          <Link href={`/account/orders/${latest.orderNumber}`} className="mt-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-ink">#{latest.orderNumber}</p>
              <p className="text-2xs text-ink-500">
                {latest.createdAt.toLocaleDateString('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' })} · {formatPaise(latest.totalPaise)}
              </p>
            </div>
            <span className="rounded-full bg-brand-orange-50 px-2.5 py-1 text-2xs font-bold text-brand-orange-600">{orderStatusLabel(latest.status)}</span>
          </Link>
        ) : (
          <p className="mt-2 text-xs text-ink-500">
            No orders yet.{' '}
            <Link href="/shop" className="font-bold text-brand-orange">
              Start shopping →
            </Link>
          </p>
        )}
      </div>
    </AccountLayout>
  );
}
