'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, ConfirmDialog, Modal, resolveImageSrc } from '@20mart/ui';
import { slugify } from '@20mart/shared';
import { ArrowDown, ArrowUp, Edit2, FolderTree, Plus, Power, Trash2 } from 'lucide-react';
import { api, ApiError, errMsg } from '../../../lib/api';
import { useAdmin } from '../../../lib/admin-store';
import { inputCls, labelCls, StatusBadge, Table, TableEmpty, TBody, Td, Th, THead, textareaCls } from '../../../components/ui';
import { ImageUploadField } from '../../../components/ImageUploadField';

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  displayOrder: number;
  seoTitle: string | null;
  seoDescription: string | null;
  parentId: string | null;
  parent: { name: string } | null;
  _count: { products: number; children: number };
}

type Perms = { create: boolean; update: boolean; remove: boolean; upload: boolean };

export function CategoriesTable({
  items,
  parents,
  perms,
  reorderable,
}: {
  items: CategoryRow[];
  parents: { id: string; name: string }[];
  perms: Perms;
  reorderable: boolean;
}) {
  const router = useRouter();
  const { showToast } = useAdmin();
  const [editing, setEditing] = useState<CategoryRow | 'new' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CategoryRow | null>(null);
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
      <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 border-b border-line-subtle">
        <p className="text-xs text-ink-500">{reorderable ? 'Use the arrows to change storefront order.' : 'Clear filters to reorder.'}</p>
        {perms.create && (
          <Button size="sm" variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setEditing('new')}>
            Add category
          </Button>
        )}
      </div>
      <Table minWidth={720}>
        <THead>
          <Th>Category</Th>
          <Th>Parent</Th>
          <Th className="text-right">Products</Th>
          <Th>Status</Th>
          <Th>Order</Th>
          <Th className="text-right">Actions</Th>
        </THead>
        <TBody>
          {items.length === 0 && (
            <TableEmpty colSpan={6} title="No categories found" description="Try a different search, or add your first category." />
          )}
          {items.map((c, idx) => (
            <tr key={c.id} className={`hover:bg-surface-muted/60 ${busyId === c.id ? 'opacity-60' : ''}`}>
              <Td>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-line-subtle bg-surface-page">
                    {c.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={resolveImageSrc(c.imageUrl)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-ink-400">
                        <FolderTree className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{c.name}</p>
                    <p className="truncate font-mono text-2xs text-ink-400">/{c.slug}</p>
                  </div>
                </div>
              </Td>
              <Td>{c.parent?.name ?? <span className="text-ink-400">—</span>}</Td>
              <Td className="text-right font-semibold text-ink-800">{c._count.products}</Td>
              <Td>
                <StatusBadge status={c.status} label={c.status === 'ACTIVE' ? 'Active' : 'Disabled'} />
              </Td>
              <Td>
                {perms.update && reorderable ? (
                  <div className="flex items-center gap-0.5">
                    <IconBtn label="Move up" disabled={idx === 0 || !!busyId} onClick={() => run(c.id, () => api(`/api/admin/categories/${c.id}/move`, { body: { direction: 'up' } }), 'Order updated')}>
                      <ArrowUp className="w-3.5 h-3.5" />
                    </IconBtn>
                    <IconBtn
                      label="Move down"
                      disabled={idx === items.length - 1 || !!busyId}
                      onClick={() => run(c.id, () => api(`/api/admin/categories/${c.id}/move`, { body: { direction: 'down' } }), 'Order updated')}
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </IconBtn>
                  </div>
                ) : (
                  <span className="text-ink-400">{c.displayOrder}</span>
                )}
              </Td>
              <Td className="text-right">
                <div className="flex items-center justify-end gap-0.5">
                  {perms.update && (
                    <>
                      <IconBtn label="Edit" onClick={() => setEditing(c)}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </IconBtn>
                      <IconBtn
                        label={c.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                        disabled={!!busyId}
                        onClick={() =>
                          run(
                            c.id,
                            () => api(`/api/admin/categories/${c.id}`, { method: 'PATCH', body: { status: c.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } }),
                            c.status === 'ACTIVE' ? 'Category disabled' : 'Category enabled'
                          )
                        }
                      >
                        <Power className={`w-3.5 h-3.5 ${c.status === 'ACTIVE' ? 'text-success' : ''}`} />
                      </IconBtn>
                    </>
                  )}
                  {perms.remove && (
                    <IconBtn label="Delete" danger onClick={() => setConfirmDelete(c)}>
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
        <CategoryForm
          category={editing === 'new' ? null : editing}
          parents={parents}
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
        title="Delete category?"
        message={
          confirmDelete && confirmDelete._count.products + confirmDelete._count.children > 0
            ? `"${confirmDelete.name}" still contains products or sub-categories, so it cannot be deleted. Disable it instead.`
            : `"${confirmDelete?.name}" will be permanently removed.`
        }
        confirmText="Delete"
        variant="danger"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          const c = confirmDelete!;
          setConfirmDelete(null);
          run(c.id, () => api(`/api/admin/categories/${c.id}`, { method: 'DELETE' }), 'Category deleted');
        }}
      />
    </>
  );
}

export function IconBtn({
  label,
  onClick,
  children,
  disabled,
  danger,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md p-1.5 text-ink-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
        danger ? 'hover:bg-danger-soft hover:text-danger' : 'hover:bg-surface-muted hover:text-ink-700'
      }`}
    >
      {children}
    </button>
  );
}

function CategoryForm({
  category,
  parents,
  canUpload,
  onClose,
  onSaved,
}: {
  category: CategoryRow | null;
  parents: { id: string; name: string }[];
  canUpload: boolean;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [form, setForm] = useState({
    name: category?.name ?? '',
    slug: category?.slug ?? '',
    description: category?.description ?? '',
    status: category?.status ?? 'ACTIVE',
    parentId: category?.parentId ?? '',
    seoTitle: category?.seoTitle ?? '',
    seoDescription: category?.seoDescription ?? '',
  });
  const [slugTouched, setSlugTouched] = useState(!!category);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v, ...(k === 'name' && !slugTouched ? { slug: slugify(v) } : {}) }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});
    const body = { ...form, parentId: form.parentId || null };
    try {
      if (category) await api(`/api/admin/categories/${category.id}`, { method: 'PATCH', body });
      else await api('/api/admin/categories', { body });
      onSaved(category ? 'Category updated' : 'Category created — open it again to add an image');
    } catch (err) {
      setError(errMsg(err));
      if (err instanceof ApiError) setFieldErrors(err.fieldErrors);
    } finally {
      setSaving(false);
    }
  };

  const fe = (k: string) => fieldErrors[k]?.[0] && <p className="mt-0.5 text-2xs text-danger">{fieldErrors[k][0]}</p>;

  return (
    <Modal isOpen onClose={onClose} title={category ? `Edit “${category.name}”` : 'New category'} maxWidth="lg">
      <form onSubmit={submit} className="space-y-3 text-xs">
        {error && <p className="rounded-lg bg-danger-soft p-2 text-danger">{error}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Name *</label>
            <input className={inputCls} required maxLength={80} value={form.name} onChange={(e) => set('name', e.target.value)} />
            {fe('name')}
          </div>
          <div>
            <label className={labelCls}>Slug *</label>
            <input
              className={`${inputCls} font-mono`}
              required
              maxLength={80}
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set('slug', e.target.value.toLowerCase());
              }}
            />
            {fe('slug')}
          </div>
          <div>
            <label className={labelCls}>Parent category</label>
            <select className={inputCls} value={form.parentId} onChange={(e) => set('parentId', e.target.value)}>
              <option value="">None (top level)</option>
              {parents
                .filter((p) => p.id !== category?.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select className={inputCls} value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Disabled</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <textarea className={textareaCls} rows={2} maxLength={500} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </div>
        {category && canUpload && (
          <ImageUploadField endpoint={`/api/admin/categories/${category.id}/image`} currentUrl={category.imageUrl} label="Category image" onUploaded={() => undefined} />
        )}
        <details className="rounded-lg border border-line-subtle p-2.5">
          <summary className="cursor-pointer text-2xs font-semibold text-ink-700">SEO</summary>
          <div className="mt-2 space-y-2">
            <div>
              <label className={labelCls}>SEO title ({form.seoTitle.length}/70)</label>
              <input className={inputCls} maxLength={70} value={form.seoTitle} onChange={(e) => set('seoTitle', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>SEO description ({form.seoDescription.length}/160)</label>
              <textarea className={textareaCls} rows={2} maxLength={160} value={form.seoDescription} onChange={(e) => set('seoDescription', e.target.value)} />
            </div>
          </div>
        </details>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="brand" size="sm" isLoading={saving}>
            {category ? 'Save changes' : 'Create category'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
