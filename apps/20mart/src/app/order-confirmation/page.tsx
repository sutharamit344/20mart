'use client';

import React, { Suspense } from 'react';
import OrderSuccessPage from '../order-success/page';

export default function OrderConfirmationPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-gray-400">Loading order confirmation...</div>}>
      <OrderSuccessPage />
    </Suspense>
  );
}

