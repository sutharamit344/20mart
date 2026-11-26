'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, errMsg } from '../../../lib/api';
import { useAdmin } from '../../../lib/admin-store';

export function RetryEmail({ id }: { id: string }) {
  const router = useRouter();
  const { showToast } = useAdmin();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      className="ml-1 font-bold text-brand-green hover:underline disabled:opacity-50"
      onClick={async () => {
        setBusy(true);
        try {
          const r = await api<{ status: string | null }>(`/api/admin/notifications/${id}/retry`, { method: 'POST' });
          showToast(`Retry result: ${(r.status ?? 'queued').toLowerCase()}`);
          router.refresh();
        } catch (e) {
          showToast(errMsg(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? 'Retrying…' : 'Retry'}
    </button>
  );
}
