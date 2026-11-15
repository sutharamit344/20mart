import { redirect } from 'next/navigation';
import { prisma } from '@20mart/database';
import { getCurrentCustomer } from '@20mart/server/next';

export const dynamic = 'force-dynamic';

/** "Track order" → the customer's most recent active order (or the order list). */
export default async function TrackLatestOrder() {
  const customer = (await getCurrentCustomer())!;
  const latest = await prisma.order.findFirst({
    where: { userId: customer.id, status: { notIn: ['DELIVERED', 'CANCELLED', 'FAILED'] } },
    orderBy: { createdAt: 'desc' },
    select: { orderNumber: true },
  });
  redirect(latest ? `/account/orders/${latest.orderNumber}` : '/account/orders');
}
