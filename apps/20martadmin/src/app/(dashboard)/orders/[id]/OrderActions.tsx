'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@20mart/ui';
import { api, errMsg } from '../../../../lib/api';
import { useAdmin } from '../../../../lib/admin-store';
import { formatINR, inputCls, StatusBadge, textareaCls } from '../../../../components/ui';

type Perms = { update: boolean; cancel: boolean; refund: boolean };
const CANCELLABLE = ['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'READY_FOR_DISPATCH', 'OUT_FOR_DELIVERY'];

type Props =
  | {
      mode: 'status';
      orderId: string;
      status: string;
      nextStatus: string | null;
      nextLabel: string | null;
      paymentMethod: string;
      paymentStatus: string;
      perms: Perms;
    }
  | {
      mode: 'refunds';
      orderId: string;
      refunds: { id: string; status: string; provider: string; amountPaise: number; reason: string; reference: string | null; failureReason: string | null; by: string | null }[];
      perms: Perms;
    }
  | { mode: 'notes'; orderId: string; notes: { id: string; note: string; by: string; at: string }[]; perms: Perms };

/** Client actions for an order. Every call is re-authorized on the server (orders.update / cancel / refund). */
export function OrderActions(props: Props) {
  const router = useRouter();
  const { showToast } = useAdmin();
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [note, setNote] = useState('');
  const [manualRef, setManualRef] = useState<Record<string, string>>({});

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      showToast(ok);
      setReason('');
      setNote('');
      setCancelOpen(false);
      router.refresh();
    } catch (e) {
      showToast(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  if (props.mode === 'status') {
    const { orderId, status, nextStatus, nextLabel, paymentMethod, paymentStatus, perms } = props;
    const awaitingOnlinePayment = nextStatus === 'CONFIRMED' && paymentMethod === 'ONLINE' && paymentStatus !== 'PAID';
    return (
      <div className="space-y-3 text-xs">
        {nextStatus && perms.update ? (
          awaitingOnlinePayment ? (
            <p className="rounded-lg bg-amber-50 p-2 text-amber-800">Waiting for online payment. The order confirms automatically once the payment is verified.</p>
          ) : (
            <div className="space-y-2">
              <input className={inputCls} placeholder="Note for history (optional)" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
              <Button
                size="sm"
                variant="brand"
                className="w-full"
                isLoading={busy}
                onClick={() => run(() => api(`/api/admin/orders/${orderId}/status`, { body: { toStatus: nextStatus, reason: reason || undefined } }), `Order marked ${nextLabel}`)}
              >
                Mark as {nextLabel}
              </Button>
              {nextStatus === 'DELIVERED' && paymentMethod === 'CASH_ON_DELIVERY' && (
                <p className="text-[11px] text-gray-500">Marking delivered records the cash payment as collected.</p>
              )}
            </div>
          )
        ) : (
          <p className="text-gray-500">{nextStatus ? 'You can view this order but not change its status.' : 'No further fulfilment steps.'}</p>
        )}

        {perms.cancel && CANCELLABLE.includes(status) && (
          <div className="border-t border-gray-100 pt-3">
            {cancelOpen ? (
              <div className="space-y-2">
                <textarea className={textareaCls} rows={2} placeholder="Reason (shown to the customer)" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setCancelOpen(false)}>
                    Back
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    className="flex-1"
                    isLoading={busy}
                    disabled={reason.trim().length < 3}
                    onClick={() => run(() => api(`/api/admin/orders/${orderId}/cancel`, { body: { reason } }), 'Order cancelled')}
                  >
                    Cancel order
                  </Button>
                </div>
                <p className="text-[11px] text-gray-500">Stock is released or restocked. Paid orders get a refund request.</p>
              </div>
            ) : (
              <button type="button" onClick={() => setCancelOpen(true)} className="font-semibold text-red-600 hover:underline">
                Cancel order…
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  if (props.mode === 'refunds') {
    const { refunds, perms } = props;
    return (
      <div className="space-y-2">
        {refunds.map((r) => (
          <div key={r.id} className="space-y-1.5 rounded-lg border border-gray-100 p-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-gray-800">
                {formatINR(r.amountPaise)} · {r.provider}
              </span>
              <StatusBadge status={r.status === 'PROCESSED' ? 'ACTIVE' : r.status === 'FAILED' ? 'OUT' : 'LOW'} label={r.status.toLowerCase()} />
            </div>
            <p className="text-[11px] text-gray-500">
              {r.reason}
              {r.reference ? ` · Ref ${r.reference}` : ''}
              {r.by ? ` · by ${r.by}` : ''}
            </p>
            {r.failureReason && <p className="text-[11px] text-red-600">{r.failureReason}</p>}
            {perms.refund && r.provider === 'RAZORPAY' && (r.status === 'REQUESTED' || r.status === 'FAILED') && (
              <Button size="sm" variant="primary" isLoading={busy} onClick={() => run(() => api(`/api/admin/refunds/${r.id}/initiate`, { body: {} }), 'Refund sent to the payment provider')}>
                Initiate refund
              </Button>
            )}
            {perms.refund && r.provider === 'RAZORPAY' && r.status === 'PENDING' && (
              <Button size="sm" variant="outline" isLoading={busy} onClick={() => run(() => api(`/api/admin/refunds/${r.id}/sync`, { body: {} }), 'Refund status refreshed')}>
                Check status with provider
              </Button>
            )}
            {perms.refund && r.provider !== 'RAZORPAY' && r.status !== 'PROCESSED' && (
              <div className="flex gap-1.5">
                <input
                  className={inputCls}
                  placeholder="Cash/UPI refund reference"
                  value={manualRef[r.id] ?? ''}
                  onChange={(e) => setManualRef((m) => ({ ...m, [r.id]: e.target.value }))}
                />
                <Button
                  size="sm"
                  variant="brand"
                  isLoading={busy}
                  disabled={(manualRef[r.id] ?? '').trim().length < 3}
                  onClick={() => run(() => api(`/api/admin/refunds/${r.id}/manual`, { body: { reference: manualRef[r.id] } }), 'Manual refund recorded')}
                >
                  Record
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  const { orderId, notes, perms } = props;
  return (
    <div className="space-y-2 text-xs">
      {perms.update && (
        <div className="space-y-1.5">
          <textarea className={textareaCls} rows={2} placeholder="Add an internal note (not visible to the customer)" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
          <Button size="sm" variant="outline" isLoading={busy} disabled={!note.trim()} onClick={() => run(() => api(`/api/admin/orders/${orderId}/notes`, { body: { note } }), 'Note added')}>
            Add note
          </Button>
        </div>
      )}
      {notes.length === 0 && <p className="text-gray-400">No notes yet.</p>}
      {notes.map((n) => (
        <div key={n.id} className="rounded-lg bg-gray-50 p-2">
          <p className="whitespace-pre-wrap text-gray-800">{n.note}</p>
          <p className="mt-0.5 text-[10px] text-gray-400">
            {n.by} · {new Date(n.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>
      ))}
    </div>
  );
}
