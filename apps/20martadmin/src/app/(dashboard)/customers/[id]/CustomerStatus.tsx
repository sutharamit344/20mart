'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Modal } from '@20mart/ui';
import { api, errMsg } from '../../../../lib/api';
import { useAdmin } from '../../../../lib/admin-store';
import { labelCls, textareaCls } from '../../../../components/ui';

export function CustomerStatus({ id, status }: { id: string; status: 'ACTIVE' | 'SUSPENDED' }) {
  const router = useRouter();
  const { showToast } = useAdmin();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const next = status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
  return (
    <>
      <Button size="sm" variant={next === 'SUSPENDED' ? 'danger' : 'brand'} onClick={() => setOpen(true)}>
        {next === 'SUSPENDED' ? 'Deactivate' : 'Reactivate'}
      </Button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title={next === 'SUSPENDED' ? 'Deactivate customer' : 'Reactivate customer'}>
        <div className="space-y-2 text-xs">
          {next === 'SUSPENDED' && <p className="text-ink-600">The customer is signed out everywhere immediately and cannot sign in until reactivated. Existing orders are not changed.</p>}
          <label className={labelCls} htmlFor="cs-reason">
            Reason (kept in the audit log)
          </label>
          <textarea id="cs-reason" rows={3} maxLength={300} className={textareaCls} value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex justify-end">
            <Button
              size="sm"
              variant={next === 'SUSPENDED' ? 'danger' : 'brand'}
              isLoading={busy}
              disabled={reason.trim().length < 3}
              onClick={async () => {
                setBusy(true);
                try {
                  await api(`/api/admin/customers/${id}/status`, { method: 'PATCH', body: { status: next, reason } });
                  showToast(next === 'SUSPENDED' ? 'Customer deactivated' : 'Customer reactivated');
                  setOpen(false);
                  router.refresh();
                } catch (e) {
                  showToast(errMsg(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Confirm
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
