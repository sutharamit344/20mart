import { redirect } from 'next/navigation';
import { getCurrentCustomer } from '@20mart/server/next';

export const dynamic = 'force-dynamic';

/** Checkout requires a signed-in customer (verified server-side). */
export default async function CheckoutLayout({ children }: { children: React.ReactNode }) {
  if (!(await getCurrentCustomer())) redirect('/auth?returnTo=/checkout');
  return <>{children}</>;
}
