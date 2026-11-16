import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentCustomer } from '@20mart/server/next';

export const dynamic = 'force-dynamic';

/** Private: never indexed (also sent as X-Robots-Tag by next.config). */
export const metadata: Metadata = { title: 'Checkout – 20Mart', robots: { index: false, follow: false } };

/** Checkout requires a signed-in customer (verified server-side). */
export default async function CheckoutLayout({ children }: { children: React.ReactNode }) {
  if (!(await getCurrentCustomer())) redirect('/auth?returnTo=/checkout');
  return <>{children}</>;
}
