'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Modal } from '@20mart/ui';
import { KeyRound, Plus, Power, ShieldCheck } from 'lucide-react';
import { api, ApiError, errMsg } from '../../../lib/api';
import { useAdmin } from '../../../lib/admin-store';
import { inputCls, labelCls, StatusBadge, Table, TBody, Td, Th, THead } from '../../../components/ui';
import { IconBtn } from '../categories/CategoriesTable';

interface AdminRow {
  id: string;
  username: string;
  email: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  lastLoginAt: string | null;
  roles: { key: string; name: string }[];
}
interface RoleOpt {
  key: string;
  name: string;
  permissions: string[];
}
interface Me {
  id: string;
  permissions: string[];
  isSuper: boolean;
}

export function AdminsTable({ admins, roles, me }: { admins: AdminRow[]; roles: RoleOpt[]; me: Me }) {
  const router = useRouter();
  const { showToast } = useAdmin();
  const has = (p: string) => me.permissions.includes(p);
  // Mirrors the server rule: you can only grant roles whose permissions you hold.
  const grantable = (r: RoleOpt) => (r.key === 'SUPER_ADMIN' ? me.isSuper : r.permissions.every((p) => me.permissions.includes(p)));
  const [creating, setCreating] = useState(false);
  const [rolesFor, setRolesFor] = useState<AdminRow | null>(null);
  const [resetFor, setResetFor] = useState<AdminRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = async (a: AdminRow) => {
    setBusy(a.id);
    try {
      await api(`/api/admin/admins/${a.id}/status`, { body: { status: a.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } });
      showToast(a.status === 'ACTIVE' ? `${a.name} deactivated and signed out` : `${a.name} reactivated`);
      router.refresh();
    } catch (e) {
      showToast(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      {has('users.manage') && (
        <div className="flex justify-end px-3 sm:px-4 py-2.5 border-b border-line-subtle">
          <Button size="sm" variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setCreating(true)}>
            Add admin
          </Button>
        </div>
      )}
      <Table minWidth={720}>
        <THead>
          <Th>Admin</Th>
          <Th>Roles</Th>
          <Th>Status</Th>
          <Th>Last sign-in</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {admins.map((a) => {
            const self = a.id === me.id;
            return (
              <tr key={a.id} className={`hover:bg-surface-muted/60 ${busy === a.id ? 'opacity-60' : ''}`}>
                <Td>
                  <p className="font-semibold text-ink">
                    {a.name} {self && <span className="text-2xs font-normal text-ink-400">(you)</span>}
                  </p>
                  <p className="text-2xs text-ink-400">
                    @{a.username} · {a.email}
                  </p>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {a.roles.length ? a.roles.map((r) => <StatusBadge key={r.key} status="ROLE" label={r.name} />) : <span className="text-ink-400">No role</span>}
                  </div>
                </Td>
                <Td>
                  <StatusBadge status={a.status} />
                </Td>
                <Td className="whitespace-nowrap text-ink-500">
                  {a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Never'}
                </Td>
                <Td className="text-right">
                  {!self && (
                    <div className="flex items-center justify-end gap-0.5">
                      {has('roles.manage') && (
                        <IconBtn label="Change roles" onClick={() => setRolesFor(a)}>
                          <ShieldCheck className="w-3.5 h-3.5" />
                        </IconBtn>
                      )}
                      {has('users.manage') && (
                        <>
                          <IconBtn label="Reset password" onClick={() => setResetFor(a)}>
                            <KeyRound className="w-3.5 h-3.5" />
                          </IconBtn>
                          <IconBtn label={a.status === 'ACTIVE' ? 'Deactivate' : 'Activate'} danger={a.status === 'ACTIVE'} disabled={!!busy} onClick={() => toggle(a)}>
                            <Power className={`w-3.5 h-3.5 ${a.status === 'ACTIVE' ? 'text-success' : ''}`} />
                          </IconBtn>
                        </>
                      )}
                    </div>
                  )}
                </Td>
              </tr>
            );
          })}
        </TBody>
      </Table>

      {creating && (
        <CreateAdminModal
          roles={has('roles.manage') ? roles.filter((r) => grantable(r) && r.key !== 'SUPER_ADMIN') : []}
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            showToast('Admin created. Share the temporary password securely.');
            router.refresh();
          }}
        />
      )}
      {rolesFor && (
        <RolesModal
          admin={rolesFor}
          roles={roles}
          grantable={grantable}
          onClose={() => setRolesFor(null)}
          onDone={() => {
            setRolesFor(null);
            showToast('Roles updated');
            router.refresh();
          }}
        />
      )}
      {resetFor && (
        <ResetPasswordModal
          admin={resetFor}
          onClose={() => setResetFor(null)}
          onDone={() => {
            setResetFor(null);
            showToast('Password reset — their sessions were signed out');
          }}
        />
      )}
    </>
  );
}

function CreateAdminModal({ roles, onClose, onDone }: { roles: RoleOpt[]; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '' });
  const [roleKeys, setRoleKeys] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api('/api/admin/admins', { body: { ...form, roleKeys } });
      onDone();
    } catch (err) {
      setError(errMsg(err));
      if (err instanceof ApiError) setFieldErrors(err.fieldErrors);
    } finally {
      setSaving(false);
    }
  };
  const fe = (k: string) => fieldErrors[k]?.[0] && <p className="mt-0.5 text-2xs text-danger">{fieldErrors[k][0]}</p>;
  return (
    <Modal isOpen onClose={onClose} title="Add admin user" maxWidth="md">
      <form onSubmit={submit} className="space-y-3 text-xs">
        {error && <p className="rounded-lg bg-danger-soft p-2 text-danger">{error}</p>}
        <div>
          <label className={labelCls}>Full name *</label>
          <input className={inputCls} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Username *</label>
            <input className={inputCls} required autoCapitalize="none" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} />
            {fe('username')}
          </div>
          <div>
            <label className={labelCls}>Email *</label>
            <input className={inputCls} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            {fe('email')}
          </div>
        </div>
        <div>
          <label className={labelCls}>Temporary password * (min 12 characters)</label>
          <input className={inputCls} type="password" autoComplete="new-password" required minLength={12} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          {fe('password')}
        </div>
        {roles.length > 0 && (
          <fieldset>
            <legend className={labelCls}>Roles</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {roles.map((r) => (
                <label key={r.key} className="flex items-center gap-2 rounded-lg border border-line p-2">
                  <input
                    type="checkbox"
                    className="accent-brand-green"
                    checked={roleKeys.includes(r.key)}
                    onChange={(e) => setRoleKeys((ks) => (e.target.checked ? [...ks, r.key] : ks.filter((k) => k !== r.key)))}
                  />
                  {r.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="brand" size="sm" isLoading={saving}>
            Create admin
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function RolesModal({
  admin,
  roles,
  grantable,
  onClose,
  onDone,
}: {
  admin: AdminRow;
  roles: RoleOpt[];
  grantable: (r: RoleOpt) => boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [keys, setKeys] = useState<string[]>(admin.roles.map((r) => r.key));
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addingSuper = keys.includes('SUPER_ADMIN') && !admin.roles.some((r) => r.key === 'SUPER_ADMIN');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api(`/api/admin/admins/${admin.id}/roles`, { method: 'PUT', body: { roleKeys: keys, confirmPassword: addingSuper ? password : undefined } });
      onDone();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal isOpen onClose={onClose} title={`Roles for ${admin.name}`} maxWidth="md">
      <form onSubmit={submit} className="space-y-3 text-xs">
        {error && <p className="rounded-lg bg-danger-soft p-2 text-danger">{error}</p>}
        <div className="space-y-1.5">
          {roles.map((r) => {
            const allowed = grantable(r);
            return (
              <label key={r.key} className={`flex items-start gap-2 rounded-lg border p-2 ${allowed ? 'border-line' : 'border-line-subtle opacity-50'}`}>
                <input
                  type="checkbox"
                  className="mt-0.5 accent-brand-green"
                  disabled={!allowed}
                  checked={keys.includes(r.key)}
                  onChange={(e) => setKeys((ks) => (e.target.checked ? [...ks, r.key] : ks.filter((k) => k !== r.key)))}
                />
                <span>
                  <span className="font-semibold text-ink">{r.name}</span>
                  <span className="block text-2xs text-ink-400">
                    {r.permissions.length} permissions{!allowed && ' · you cannot grant this role'}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        {addingSuper && (
          <div>
            <label className={labelCls}>Confirm your password to grant Super Admin *</label>
            <input className={inputCls} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        )}
        <p className="text-2xs text-ink-400">Removing a role signs the admin out so the new permissions take effect immediately.</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="brand" size="sm" isLoading={saving}>
            Save roles
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({ admin, onClose, onDone }: { admin: AdminRow; onClose: () => void; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api(`/api/admin/admins/${admin.id}/password`, { body: { password } });
      onDone();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal isOpen onClose={onClose} title={`Reset password for ${admin.name}`} maxWidth="sm">
      <form onSubmit={submit} className="space-y-3 text-xs">
        {error && <p className="rounded-lg bg-danger-soft p-2 text-danger">{error}</p>}
        <div>
          <label className={labelCls}>New temporary password (min 12)</label>
          <input className={inputCls} type="password" autoComplete="new-password" minLength={12} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" size="sm" isLoading={saving}>
            Reset password
          </Button>
        </div>
      </form>
    </Modal>
  );
}
