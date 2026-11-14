import React from 'react';
import type { Metadata } from 'next';
import { mockOrders } from '@20mart/shared';
import { OrderDetailView } from '../../../../components/OrderDetailView';

interface OrderPageProps {
  params: {
    id: string;
  };
}

export function generateStaticParams() {
  return mockOrders.map((o) => ({
    id: o.orderNumber,
  }));
}

export function generateMetadata({ params }: OrderPageProps): Metadata {
  return {
    title: `Order #${params.id} Details – 20Mart`,
    description: `Track and view items in 20Mart order #${params.id}.`,
  };
}

export default function OrderDetailsPage({ params }: OrderPageProps) {
  return <OrderDetailView orderId={params.id} />;
}
