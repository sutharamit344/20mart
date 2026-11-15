import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@20mart/database';
import { adminRequest, adminSession, createCustomer, ctxParams, customerRequest, resetDb } from './helpers';

const STORE = '../../../apps/20mart/src/app/api/inquiries/route';
const ADMIN = '../../../apps/20martadmin/src/app/api/admin/inquiries';

beforeEach(resetDb);

const valid = { name: 'Asha Patel', email: 'Asha@Example.com', phone: '+91 98765 43210', subject: 'Returns & Refunds', message: 'My order arrived with a broken lid.' };

describe('contact inquiries', () => {
  it('stores a validated message with a server-issued ticket and server-chosen priority', async () => {
    const { POST } = await import(STORE);
    const res = await POST(customerRequest('/api/inquiries', { method: 'POST', body: { ...valid, priority: 'LOW', status: 'RESOLVED' } }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.inquiry.ticketNumber).toMatch(/^INQ-[0-9A-Z]{6}$/);
    expect(Object.keys(body.inquiry)).toEqual(['ticketNumber']); // nothing else echoed back
    const row = await prisma.contactInquiry.findUniqueOrThrow({ where: { ticketNumber: body.inquiry.ticketNumber } });
    expect(row).toMatchObject({ email: 'asha@example.com', phone: '9876543210', status: 'NEW', priority: 'HIGH', userId: null });
    const bad = await POST(customerRequest('/api/inquiries', { method: 'POST', body: { name: 'A', email: 'nope', message: 'hi' } }));
    expect(bad.status).toBe(400);
    expect(await prisma.contactInquiry.count()).toBe(1);
  });

  it('links signed-in customers and exposes no public read endpoint', async () => {
    const mod = await import(STORE);
    expect('GET' in mod).toBe(false);
    const c = await createCustomer();
    await mod.POST(customerRequest('/api/inquiries', { method: 'POST', token: c.token, body: valid }));
    expect((await prisma.contactInquiry.findFirstOrThrow()).userId).toBe(c.user.id);
  });

  it('admin access requires inquiries permissions; customers and other staff are refused', async () => {
    const { POST } = await import(STORE);
    await POST(customerRequest('/api/inquiries', { method: 'POST', body: valid }));
    const id = (await prisma.contactInquiry.findFirstOrThrow()).id;
    const list = await import(`${ADMIN}/route`);
    const one = await import(`${ADMIN}/[id]/route`);
    const c = await createCustomer();
    expect((await list.GET(adminRequest('/api/admin/inquiries', { token: c.token }))).status).toBe(401);
    const inv = await adminSession('invmgr', ['INVENTORY_MANAGER']);
    expect((await list.GET(adminRequest('/api/admin/inquiries', { token: inv.token }))).status).toBe(403);
    const om = await adminSession('ordermgr', ['ORDER_MANAGER']);
    const listed = await (await list.GET(adminRequest('/api/admin/inquiries', { token: om.token }))).json();
    expect(listed.total).toBe(1);
    expect(listed.newCount).toBe(1);
    const upd = await one.PATCH(adminRequest('/x', { method: 'PATCH', token: om.token, body: { status: 'RESOLVED', adminNotes: 'Replacement sent' } }), ctxParams({ id }));
    expect(upd.status).toBe(200);
    expect(await prisma.contactInquiry.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'RESOLVED', adminNotes: 'Replacement sent' });
    expect(await prisma.adminAuditLog.count({ where: { entityId: id } })).toBe(1);
  });
});
