'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Modal } from '@20mart/ui';
import { api, errMsg } from '../../../../lib/api';
import { useAdmin } from '../../../../lib/admin-store';
import { labelCls, textareaCls } from '../../../../components/ui';

export function CouponActions({ id, isActive, canUpdate, canDelete }: { id: string; isActive: boolean; canUpdate: boolean; canDelete: boolean }) {
  const router = useRouter();
  const { showToast } = useAdmin();
  const [busy, setBusy] = useState<string | null>(null);
  const [issueOpen, setIssueOpen] = useState(false);
  const [emails, setEmails] = useState('');
  const [result, setResult] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      showToast(ok);
      router.refresh();
      return true;
    } catch (e) {
      showToast(errMsg(e));
      return false;
    } finally {
      setBusy(null);
    }
  };

  if (!canUpdate && !canDelete) return null;
  return (
    <>
      {canUpdate && (
        <>
          <Button size="sm" variant="outline" isLoading={busy === 'issue'} onClick={() => setIssueOpen(true)}>
            Issue to customers
          </Button>
          <Button size="sm" variant={isActive ? 'outline' : 'brand'} isLoading={busy === 'toggle'} onClick={() => run('toggle', () => api(`/api/admin/coupons/${id}/status`, { method: 'PATCH', body: { isActive: !isActive } }), isActive ? 'Coupon deactivated' : 'Coupon activated')}>
            {isActive ? 'Deactivate' : 'Activate'}
          </Button>
        </>
      )}
      {canDelete && (
        <Button
          size="sm"
          variant="outline"
          isLoading={busy === 'delete'}
          onClick={async () => {
            if (!window.confirm('Delete this coupon? This cannot be undone.')) return;
            if (await run('delete', () => api(`/api/admin/coupons/${id}`, { method: 'DELETE' }), 'Coupon deleted')) router.push('/coupons');
          }}
        >
          Delete
        </Button>
      )}
      <Modal isOpen={issueOpen} onClose={() => setIssueOpen(false)} title="Issue coupon to customers">
        <div className="space-y-2 text-xs">
          <label className={labelCls} htmlFor="issue-emails">
            Customer emails (one per line or comma-separated, max 200)
          </label>
          <textarea id="issue-emails" rows={5} className={textareaCls} value={emails} onChange={(e) => setEmails(e.target.value)} />
          <p className="text-[10px] text-gray-500">Only existing, active customer accounts receive it. Each customer is issued the coupon once and gets an in-app notification.</p>
          {result && <p className="rounded-lg bg-gray-50 p-2 text-[11px] text-gray-700">{result}</p>}
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="brand"
              isLoading={busy === 'issue'}
              onClick={async () => {
                const list = emails.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);
                if (!list.length) return;
                setBusy('issue');
                try {
                  const r = await api<{ issued: number; alreadyHad: number; notFound: string[] }>(`/api/admin/coupons/${id}/issue`, { body: { emails: list } });
                  setResult(`Issued to ${r.issued}. Already had it: ${r.alreadyHad}.${r.notFound.length ? ` No account for: ${r.notFound.join(', ')}` : ''}`);
                  router.refresh();
                } catch (e) {
                  setResult(errMsg(e));
                } finally {
                  setBusy(null);
                }
              }}
            >
              Issue coupon
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
