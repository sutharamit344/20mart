import { Fragment } from 'react';
import { Check } from 'lucide-react';
import { listAdmins, listRolesWithPermissions } from '@20mart/server';
import { requireAdminPage } from '@20mart/server/next';
import { AccessDenied, PageHeader, Panel } from '../../../components/ui';
import { AdminsTable } from './AdminsTable';

export default async function AccessPage() {
  const ctx = await requireAdminPage();
  if (!ctx.permissions.has('users.view')) return <AccessDenied permission="users.view" />;
  const [admins, { roles, permissions }] = await Promise.all([listAdmins(), listRolesWithPermissions()]);
  const groups = [...new Set(permissions.map((p) => p.group))];

  return (
    <div className="space-y-3 sm:space-y-4">
      <PageHeader title="Access management" description="Admin accounts, roles and permissions. Every change is audited and enforced on the server." />
      <Panel title={`Admin users (${admins.length})`}>
        <AdminsTable
          admins={admins.map((a) => ({ ...a, lastLoginAt: a.lastLoginAt?.toISOString() ?? null, createdAt: a.createdAt.toISOString() }))}
          roles={roles.map((r) => ({ key: r.key, name: r.name, permissions: r.permissions }))}
          me={{ id: ctx.admin.id, permissions: [...ctx.permissions], isSuper: ctx.roles.includes('SUPER_ADMIN') }}
        />
      </Panel>

      <Panel title="Role permissions">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="bg-gray-50/80 text-[10px] uppercase text-gray-500">
              <tr>
                <th className="sticky left-0 bg-gray-50 px-3 py-2">Permission</th>
                {roles.map((r) => (
                  <th key={r.id} className="px-2 py-2 text-center whitespace-nowrap">
                    {r.name}
                    <span className="block font-normal normal-case text-gray-400">{r.adminCount} admin{r.adminCount === 1 ? '' : 's'}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g}>
                  <tr className="bg-gray-50/40">
                    <td colSpan={roles.length + 1} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                      {g}
                    </td>
                  </tr>
                  {permissions
                    .filter((p) => p.group === g)
                    .map((p) => (
                      <tr key={p.key} className="border-t border-gray-50">
                        <td className="sticky left-0 bg-white px-3 py-1.5">
                          <span className="font-mono text-[11px] text-gray-800">{p.key}</span>
                          <span className="block text-[10px] text-gray-400">{p.description}</span>
                        </td>
                        {roles.map((r) => (
                          <td key={r.id} className="px-2 py-1.5 text-center">
                            {r.permissions.includes(p.key) ? <Check className="mx-auto w-3.5 h-3.5 text-emerald-600" aria-label="granted" /> : <span className="text-gray-200">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-gray-100 px-3 py-2 text-[11px] text-gray-400">
          System roles are defined in code and synced by <code>pnpm db:seed</code>; Super Admin always holds every permission.
        </p>
      </Panel>
    </div>
  );
}
