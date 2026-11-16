import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentCustomer } from '@20mart/server/next';

// Authoritative server-side gate for every /account page (middleware only checks cookie presence).
export const dynamic = 'force-dynamic';

/** Private: never indexed (also sent as X-Robots-Tag by next.config). */
export const metadata: Metadata = { title: 'My account – 20Mart', robots: { index: false, follow: false } };

export default async function AccountRouteLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentCustomer();
  if (!user) redirect('/auth?returnTo=/account');
  return <>{children}</>;
}
