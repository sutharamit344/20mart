'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@20mart/ui';
import { api, errMsg } from '../../../../lib/api';
import { useAdmin } from '../../../../lib/admin-store';

export function CampaignActions({ id, isActive, live, canUpdate, canAnnounce, canDelete }: { id: string; isActive: boolean; live: boolean; canUpdate: boolean; canAnnounce: boolean; canDelete: boolean }) {
  const router = useRouter();
  const { showToast } = useAdmin();
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<unknown>, ok: string | ((r: unknown) => string)) => {
    setBusy(key);
    try {
      const r = await fn();
      showToast(typeof ok === 'string' ? ok : ok(r));
      router.refresh();
      return true;
    } catch (e) {
      showToast(errMsg(e));
      return false;
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      {canAnnounce && live && (
        <Button
          size="sm"
          variant="outline"
          isLoading={busy === 'announce'}
          onClick={() => {
            if (!window.confirm('Send an in-app announcement to all customers and email customers who opted in to offers?')) return;
            void run('announce', () => api<{ notified: number }>(`/api/admin/campaigns/${id}/announce`, { method: 'POST' }), (r) => `Announced to ${(r as { notified: number }).notified} customer(s). Emails are queued — see the Email log for delivery status.`);
          }}
        >
          Announce
        </Button>
      )}
      {canUpdate && (
        <Button size="sm" variant={isActive ? 'outline' : 'brand'} isLoading={busy === 'toggle'} onClick={() => run('toggle', () => api(`/api/admin/campaigns/${id}/status`, { method: 'PATCH', body: { isActive: !isActive } }), isActive ? 'Campaign deactivated' : 'Campaign activated')}>
          {isActive ? 'Deactivate' : 'Activate'}
        </Button>
      )}
      {canDelete && (
        <Button
          size="sm"
          variant="outline"
          isLoading={busy === 'delete'}
          onClick={async () => {
            if (!window.confirm('Delete this campaign?')) return;
            if (await run('delete', () => api(`/api/admin/campaigns/${id}`, { method: 'DELETE' }), 'Campaign deleted')) router.push('/campaigns');
          }}
        >
          Delete
        </Button>
      )}
    </>
  );
}
