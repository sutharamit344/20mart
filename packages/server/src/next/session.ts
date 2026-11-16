import * as React from 'react';
// React.cache ships with the React canary bundled by Next 14 but is absent from @types/react@18.
// Outside Next (e.g. unit tests) fall back to no memoisation.
type CacheFn = <T extends (...args: never[]) => unknown>(fn: T) => T;
const cache: CacheFn = (React as unknown as { cache?: CacheFn }).cache ?? ((fn) => fn);
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminSessionCookie, customerSessionCookie } from '../cookies';
import { getAdminContext, type AdminContext } from '../auth/admin';
import { getCustomerBySessionToken } from '../auth/customer';

/** Current admin for Server Components (memoised per request). */
export const getCurrentAdmin = cache(async (): Promise<AdminContext | null> => {
  return getAdminContext((await cookies()).get(adminSessionCookie().name)?.value);
});

/** Gate an admin page: redirects to /login without a valid session. */
export async function requireAdminPage(): Promise<AdminContext> {
  const ctx = await getCurrentAdmin();
  if (!ctx) redirect('/login');
  return ctx;
}

/** Current customer for Server Components (memoised per request). */
export const getCurrentCustomer = cache(async () => {
  return getCustomerBySessionToken((await cookies()).get(customerSessionCookie().name)?.value);
});
