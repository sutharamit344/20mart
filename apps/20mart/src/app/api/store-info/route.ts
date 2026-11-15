import { NextResponse } from 'next/server';
import { enabledPaymentMethods, getStoreSettings } from '@20mart/server';

export const dynamic = 'force-dynamic';

/** Public, non-sensitive delivery terms shown in the cart before sign-in. */
export async function GET() {
  const s = await getStoreSettings();
  return NextResponse.json(
    {
      deliveryEnabled: s.deliveryEnabled,
      deliveryFeePaise: s.deliveryFeePaise,
      freeDeliveryThresholdPaise: s.freeDeliveryThresholdPaise,
      minOrderPaise: s.minOrderPaise,
      maxQtyPerLine: s.maxQtyPerLine,
      paymentMethods: enabledPaymentMethods(s),
    },
    { headers: { 'cache-control': 'public, max-age=60' } }
  );
}
