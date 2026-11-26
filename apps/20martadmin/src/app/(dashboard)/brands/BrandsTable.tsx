'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, ConfirmDialog, Modal, resolveImageSrc } from '@20mart/ui';
import { slugify } from '@20mart/shared';
import { BadgeCheck, Edit2, Plus, Power, Trash2 } from 'lucide-react';
import { api, ApiError, errMsg } from '../../../lib/api';
import { useAdmin } from '../../../lib/admin-store';
import { inputCls, labelCls, StatusBadge, Table, TableEmpty, TBody, Td, Th, THead, textareaCls } from '../../../components/ui';
import { ImageUploadField } from '../../../components/ImageUploadField';
import { IconBtn } from '../categories/CategoriesTable';

export interface BrandRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  _count: { products: number };
}

export function BrandsTable({ items, perms }: { items: BrandRow[]; perms: { create: boolean; update: boolean; remove: boolean; upload: boolean } }) {
  const router = useRouter();
  const { showToast } = useAdmin();
  const [editing, setEditing] = useState<BrandRow | 'new' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<BrandRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const run = async (id: string, fn: () => Promise<unknown>, ok: string) => {
    setBusyId(id);
    try {
      await fn();
      showToast(ok);
      router.refresh();
    } catch (e) {
      showToast(errMsg(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      {perms.create && (
        <div className="flex justify-end px-3 sm:px-4 py-2.5 border-b border-line-subtle">
          <Button size="sm" variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setEditing('new')}>
            Add brand
          </Button>
        </div>
      )}
      <Table minWidth={560}>
        <THead>
          <Th>Brand</Th>
          <Th className="text-right">Products</Th>
          <Th>Status</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {items.length === 0 && <TableEmpty colSpan={4} title="No brands found" description="Products without a brand are perfectly fine." />}
          {items.map((b) => (
            <tr key={b.id} className={`hover:bg-surface-muted/60 ${busyId === b.id ? 'opacity-60' : ''}`}>
              <Td>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-line-subtle bg-surface">
                    {b.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={resolveImageSrc(b.logoUrl)} alt="" className="h-full w-full object-contain p-0.5" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-ink-400">
                        <BadgeCheck className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{b.name}</p>
                    <p className="truncate font-mono text-2xs text-ink-400">{b.slug}</p>
                  </div>
                </div>
              </Td>
              <Td className="text-right font-semibold text-ink-800">{b._count.products}</Td>
              <Td>
                <StatusBadge status={b.status} label={b.status === 'ACTIVE' ? 'Active' : 'Disabled'} />
              </Td>
              <Td className="text-right">
                <div className="flex items-center justify-end gap-0.5">
                  {perms.update && (
                    <>
                      <IconBtn label="Edit" onClick={() => setEditing(b)}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </IconBtn>
                      <IconBtn
                        label={b.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                        disabled={!!busyId}
                        onClick={() =>
                          run(b.id, () => api(`/api/admin/brands/${b.id}`, { method: 'PATCH', body: { status: b.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } }), 'Brand updated')
                        }
                      >
                        <Power className={`w-3.5 h-3.5 ${b.status === 'ACTIVE' ? 'text-success' : ''}`} />
                      </IconBtn>
                    </>
                  )}
                  {perms.remove && (
                    <IconBtn label="Delete" danger onClick={() => setConfirmDelete(b)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </IconBtn>
                  )}
                </div>
              </Td>
            </tr>
          ))}
        </TBody>
      </Table>

      {editing && (
        <BrandForm
          brand={editing === 'new' ? null : editing}
          canUpload={perms.upload}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setEditing(null);
            showToast(msg);
            router.refresh();
          }}
        />
      )}
      <ConfirmDialog
        isOpen={!!confirmDelete}
        title="Delete brand?"
        message={
          confirmDelete && confirmDelete._count.products > 0
            ? `"${confirmDelete.name}" is used by ${confirmDelete._count.products} product(s) and cannot be deleted. Disable it instead.`
            : `"${confirmDelete?.name}" will be permanently removed.`
        }
        confirmText="Delete"
        variant="danger"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          const b = confirmDelete!;
          setConfirmDelete(null);
          run(b.id, () => api(`/api/admin/brands/${b.id}`, { method: 'DELETE' }), 'Brand deleted');
        }}
      />
    </>
  );
}

function BrandForm({ brand, canUpload, onClose, onSaved }: { brand: BrandRow | null; canUpload: boolean; onClose: () => void; onSaved: (m: string) => void }) {
  const [form, setForm] = useState({ name: brand?.name ?? '', slug: brand?.slug ?? '', description: brand?.description ?? '', status: brand?.status ?? 'ACTIVE' });
  const [slugTouched, setSlugTouched] = useState(!!brand);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v, ...(k === 'name' && !slugTouched ? { slug: slugify(v) } : {}) }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      if (brand) await api(`/api/admin/brands/${brand.id}`, { method: 'PATCH', body: form });
      else await api('/api/admin/brands', { body: form });
      onSaved(brand ? 'Brand updated' : 'Brand created — open it again to upload a logo');
    } catch (err) {
      setError(errMsg(err));
      if (err instanceof ApiError) setFieldErrors(err.fieldErrors);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={brand ? `Edit “${brand.name}”` : 'New brand'} maxWidth="md">
      <form onSubmit={submit} className="space-y-3 text-xs">
        {error && <p className="rounded-lg bg-danger-soft p-2 text-danger">{error}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Name *</label>
            <input className={inputCls} required maxLength={80} value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Slug *</label>
            <input
              className={`${inputCls} font-mono`}
              required
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set('slug', e.target.value.toLowerCase());
              }}
            />
            {fieldErrors.slug?.[0] && <p className="mt-0.5 text-2xs text-danger">{fieldErrors.slug[0]}</p>}
          </div>
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <textarea className={textareaCls} rows={2} maxLength={500} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select className={inputCls} value={form.status} onChange={(e) => set('status', e.target.value)}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Disabled</option>
          </select>
        </div>
        {brand && canUpload && <ImageUploadField endpoint={`/api/admin/brands/${brand.id}/logo`} currentUrl={brand.logoUrl} label="Logo" onUploaded={() => undefined} />}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="brand" size="sm" isLoading={saving}>
            {brand ? 'Save changes' : 'Create brand'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
