import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCustomerOrder } from '@20mart/server';
import { getCurrentCustomer } from '@20mart/server/next';
import { AccountLayout } from '../../../../components/AccountLayout';
import { OrderDetailView, type CustomerOrderDetail } from '../../../../components/OrderDetailView';

export const dynamic = 'force-dynamic';

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  return { title: `Order ${params.id} – 20Mart`, robots: { index: false } };
}

/** Ownership enforced server-side: other customers' order numbers resolve to 404. */
export default async function OrderDetailsPage({ params, searchParams }: { params: { id: string }; searchParams: { pay?: string } }) {
  const customer = await getCurrentCustomer();
  if (!customer) notFound();
  const order = await getCustomerOrder(customer.id, params.id).catch(() => null);
  if (!order) notFound();
  return (
    <AccountLayout title="Order details" subtitle="Track status, items and payment." activeKey="orders">
      <OrderDetailView order={JSON.parse(JSON.stringify(order)) as CustomerOrderDetail} autoPay={searchParams.pay === '1'} />
    </AccountLayout>
  );
}
