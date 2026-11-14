import { roleLabel } from '@20mart/shared';
import { env } from '@20mart/server';
import { requireAdminPage } from '@20mart/server/next';
import { AdminProvider } from '../../lib/admin-store';
import { AdminShell } from '../../components/AdminShell';

// Every dashboard page is per-admin and must never be statically cached.
export const dynamic = 'force-dynamic';

/**
 * Authoritative gate for the whole admin UI: a valid, unexpired session for an
 * ACTIVE admin is required. Individual pages and every API route additionally
 * check the specific permission they need.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAdminPage();
  const user = {
    name: ctx.admin.name,
    roleLabel: ctx.roles.length ? ctx.roles.map(roleLabel).join(', ') : 'No role assigned',
  };
  return (
    <AdminProvider adminName={ctx.admin.name}>
      <AdminShell user={user} permissions={[...ctx.permissions]} storefrontUrl={env().APP_URL}>
        {children}
      </AdminShell>
    </AdminProvider>
  );
}
