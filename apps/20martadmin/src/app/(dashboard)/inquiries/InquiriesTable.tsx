'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Drawer } from '@20mart/ui';
import { api, errMsg } from '../../../lib/api';
import { useAdmin } from '../../../lib/admin-store';
import { inputCls, labelCls, StatusBadge, Table, TableEmpty, TBody, Td, Th, THead, textareaCls } from '../../../components/ui';

interface Inquiry {
  id: string;
  ticketNumber: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  status: 'NEW' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'NORMAL' | 'HIGH';
  adminNotes: string | null;
  userId: string | null;
  createdAt: string;
}

const statusTone = (s: string) => (s === 'NEW' ? 'FEATURED' : s === 'IN_PROGRESS' ? 'LOW' : s === 'RESOLVED' ? 'ACTIVE' : 'INACTIVE');
const nice = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace('_', ' ');
const when = (d: string) => new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });

export function InquiriesTable({ items, canManage }: { items: Inquiry[]; canManage: boolean }) {
  const [open, setOpen] = useState<Inquiry | null>(null);
  return (
    <>
      <Table minWidth={760}>
        <THead>
          <Th>Ticket</Th>
          <Th>From</Th>
          <Th>Subject</Th>
          <Th>Received</Th>
          <Th>Priority</Th>
          <Th>Status</Th>
        </THead>
        <TBody>
          {items.length === 0 && <TableEmpty colSpan={6} title="No inquiries" description="Messages sent from the storefront contact form appear here." />}
          {items.map((i) => (
            <tr key={i.id} className="cursor-pointer hover:bg-surface-muted/60" onClick={() => setOpen(i)}>
              <Td className="font-mono text-2xs font-bold text-ink">{i.ticketNumber}</Td>
              <Td>
                <p className="font-semibold text-ink-800">{i.name}</p>
                <p className="text-2xs text-ink-400">
                  {i.email}
                  {i.userId ? ' · customer' : ''}
                </p>
              </Td>
              <Td className="max-w-[16rem]">
                <p className="truncate font-semibold text-ink-800">{i.subject}</p>
                <p className="truncate text-2xs text-ink-400">{i.message}</p>
              </Td>
              <Td className="whitespace-nowrap text-ink-500">{when(i.createdAt)}</Td>
              <Td>
                <StatusBadge status={i.priority === 'HIGH' ? 'OUT' : i.priority === 'LOW' ? 'INACTIVE' : 'DRAFT'} label={nice(i.priority)} />
              </Td>
              <Td>
                <StatusBadge status={statusTone(i.status)} label={nice(i.status)} />
              </Td>
            </tr>
          ))}
        </TBody>
      </Table>
      <Drawer isOpen={!!open} onClose={() => setOpen(null)} position="right" title={open ? `Inquiry ${open.ticketNumber}` : ''}>
        {open && <InquiryDetail key={open.id} inquiry={open} canManage={canManage} onDone={() => setOpen(null)} />}
      </Drawer>
    </>
  );
}

function InquiryDetail({ inquiry, canManage, onDone }: { inquiry: Inquiry; canManage: boolean; onDone: () => void }) {
  const router = useRouter();
  const { showToast } = useAdmin();
  const [status, setStatus] = useState(inquiry.status);
  const [priority, setPriority] = useState(inquiry.priority);
  const [notes, setNotes] = useState(inquiry.adminNotes ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api(`/api/admin/inquiries/${inquiry.id}`, { method: 'PATCH', body: { status, priority, adminNotes: notes } });
      showToast('Inquiry updated');
      onDone();
      router.refresh();
    } catch (e) {
      showToast(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 text-xs">
      <div className="rounded-lg bg-surface-page p-3 space-y-0.5">
        <p className="font-bold text-ink">{inquiry.name}</p>
        <p>
          <a href={`mailto:${inquiry.email}`} className="text-brand-green underline">
            {inquiry.email}
          </a>
          {inquiry.phone && <span className="text-ink-600"> · +91 {inquiry.phone}</span>}
        </p>
        <p className="text-2xs text-ink-400">{when(inquiry.createdAt)}</p>
      </div>
      <div>
        <p className="font-bold text-ink">{inquiry.subject}</p>
        <p className="mt-1 whitespace-pre-wrap break-words text-ink-700">{inquiry.message}</p>
      </div>
      {canManage ? (
        <div className="space-y-2 border-t border-line-subtle pt-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Status</label>
              <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as Inquiry['status'])}>
                {['NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((s) => (
                  <option key={s} value={s}>
                    {nice(s)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <select className={inputCls} value={priority} onChange={(e) => setPriority(e.target.value as Inquiry['priority'])}>
                {['HIGH', 'NORMAL', 'LOW'].map((s) => (
                  <option key={s} value={s}>
                    {nice(s)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Internal notes</label>
            <textarea className={textareaCls} rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Button size="sm" variant="brand" className="w-full" isLoading={saving} onClick={save}>
            Save
          </Button>
        </div>
      ) : (
        inquiry.adminNotes && <p className="rounded-lg bg-warning-soft p-2 text-warning">Notes: {inquiry.adminNotes}</p>
      )}
    </div>
  );
}
