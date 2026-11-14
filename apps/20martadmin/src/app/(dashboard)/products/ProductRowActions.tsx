'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@20mart/ui';
import { Edit2, Eye, EyeOff, Trash2 } from 'lucide-react';
import { api, errMsg } from '../../../lib/api';
import { useAdmin } from '../../../lib/admin-store';
import { IconBtn } from '../categories/CategoriesTable';

export function ProductRowActions({
  id,
  status,
  perms,
}: {
  id: string;
  status: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  perms: { update: boolean; remove: boolean };
}) {
  const router = useRouter();
  const { showToast } = useAdmin();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      const res = (await fn()) as { mode?: string } | undefined;
      showToast(res?.mode === 'archived' ? 'Product archived (it has history, so it was kept)' : ok);
      router.refresh();
    } catch (e) {
      showToast(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`flex items-center justify-end gap-0.5 ${busy ? 'opacity-50' : ''}`}>
      <Link href={`/products/${id}`} title={perms.update ? 'Edit' : 'View'} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
        <Edit2 className="w-3.5 h-3.5" />
      </Link>
      {perms.update && status !== 'ARCHIVED' && (
        <IconBtn
          label={status === 'ACTIVE' ? 'Unpublish' : 'Publish'}
          disabled={busy}
          onClick={() =>
            act(
              () => api(`/api/admin/products/${id}/status`, { body: { status: status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } }),
              status === 'ACTIVE' ? 'Product unpublished' : 'Product published'
            )
          }
        >
          {status === 'ACTIVE' ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-emerald-600" />}
        </IconBtn>
      )}
      {perms.remove && status !== 'ARCHIVED' && (
        <IconBtn label="Delete / archive" danger disabled={busy} onClick={() => setConfirm(true)}>
          <Trash2 className="w-3.5 h-3.5" />
        </IconBtn>
      )}
      <ConfirmDialog
        isOpen={confirm}
        title="Remove product?"
        message="Unpublished drafts without history are deleted permanently. Products with stock history or that were ever published are archived instead."
        confirmText="Remove"
        variant="danger"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          act(() => api(`/api/admin/products/${id}`, { method: 'DELETE' }), 'Product deleted');
        }}
      />
    </div>
  );
}
