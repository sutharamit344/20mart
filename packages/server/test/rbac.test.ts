import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@20mart/database';
import { createCustomerSession } from '../src/auth/customer';
import { getAdminContext } from '../src/auth/admin';
import { adminRequest, adminSession, categoryId, ctxParams, resetDb } from './helpers';

// The real admin route handlers, exactly as deployed.
const APP = '../../../apps/20martadmin/src/app/api/admin';
const productsRoute = () => import(`${APP}/products/route`);
const productRoute = () => import(`${APP}/products/[id]/route`);
const inventoryAdjust = () => import(`${APP}/inventory/[id]/adjust/route`);
const adminRoles = () => import(`${APP}/admins/[id]/roles/route`);
const adminsRoute = () => import(`${APP}/admins/route`);
const adminStatus = () => import(`${APP}/admins/[id]/status/route`);
const rolePerms = () => import(`${APP}/roles/[id]/permissions/route`);
const rolesRoute = () => import(`${APP}/roles/route`);

beforeEach(resetDb);

async function makeProduct(token: string) {
  const { POST } = await productsRoute();
  const res = await POST(
    adminRequest('/api/admin/products', {
      method: 'POST',
      token,
      body: { name: 'Steel Peeler', sku: 'ZM-T-001', categoryId: await categoryId(), sellingPricePaise: 2000, mrpPaise: 3000 },
    })
  );
  expect(res.status).toBe(201);
  return (await res.json()).id as string;
}

describe('admin API authentication', () => {
  it('rejects requests without a session (401)', async () => {
    const { GET } = await productsRoute();
    expect((await GET(adminRequest('/api/admin/products'))).status).toBe(401);
  });

  it('rejects a customer session cookie presented to admin APIs (401)', async () => {
    const user = await prisma.user.create({ data: { googleSubjectId: 'g-cust', email: 'c@x.com' } });
    const { token: customerToken } = await createCustomerSession(user.id);
    const { GET, POST } = await productsRoute();
    expect((await GET(adminRequest('/api/admin/products', { token: customerToken }))).status).toBe(401);
    const create = await POST(
      adminRequest('/api/admin/products', {
        method: 'POST',
        token: customerToken,
        body: { name: 'Hack', sku: 'HACK-1', categoryId: await categoryId(), sellingPricePaise: 1, mrpPaise: 1 },
      })
    );
    expect(create.status).toBe(401);
    expect(await prisma.product.count()).toBe(0);
  });

  it('blocks cross-origin state-changing requests (CSRF) even with a valid session', async () => {
    const { token } = await adminSession('super', ['SUPER_ADMIN']);
    const { POST } = await productsRoute();
    const res = await POST(
      adminRequest('/api/admin/products', {
        method: 'POST',
        token,
        origin: 'https://evil.example',
        body: { name: 'X', sku: 'X-1', categoryId: await categoryId(), sellingPricePaise: 100, mrpPaise: 100 },
      })
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('BAD_ORIGIN');
  });

  it('a deactivated admin cannot keep using an existing session', async () => {
    const sa = await adminSession('super', ['SUPER_ADMIN']);
    const pm = await adminSession('prodmgr', ['PRODUCT_MANAGER']);
    const { POST } = await adminStatus();
    const res = await POST(adminRequest(`/api/admin/admins/${pm.id}/status`, { method: 'POST', token: sa.token, body: { status: 'INACTIVE' } }), ctxParams({ id: pm.id }));
    expect(res.status).toBe(200);
    const { GET } = await productsRoute();
    expect((await GET(adminRequest('/api/admin/products', { token: pm.token }))).status).toBe(401);
  });
});

describe('permission enforcement', () => {
  it('an admin without products.update cannot edit products (403) and nothing changes', async () => {
    const sa = await adminSession('super', ['SUPER_ADMIN']);
    const id = await makeProduct(sa.token);
    const inv = await adminSession('inv', ['INVENTORY_MANAGER']); // has products.view, not products.update
    const { PATCH, GET } = await productRoute();
    expect((await GET(adminRequest(`/api/admin/products/${id}`, { token: inv.token }), ctxParams({ id }))).status).toBe(200);
    const res = await PATCH(adminRequest(`/api/admin/products/${id}`, { method: 'PATCH', token: inv.token, body: { sellingPricePaise: 1 } }), ctxParams({ id }));
    expect(res.status).toBe(403);
    expect((await prisma.product.findUniqueOrThrow({ where: { id } })).sellingPricePaise).toBe(2000);
  });

  it('a content manager cannot create products or adjust stock', async () => {
    const sa = await adminSession('super', ['SUPER_ADMIN']);
    const id = await makeProduct(sa.token);
    const cm = await adminSession('contentmgr', ['CONTENT_MANAGER']);
    const { POST } = await productsRoute();
    const res = await POST(adminRequest('/api/admin/products', { method: 'POST', token: cm.token, body: {} }));
    expect(res.status).toBe(403);
    const invRow = await prisma.inventory.findFirstOrThrow({ where: { productId: id } });
    const adj = await inventoryAdjust();
    const r2 = await adj.POST(
      adminRequest(`/api/admin/inventory/${invRow.id}/adjust`, { method: 'POST', token: cm.token, body: { type: 'STOCK_IN', quantity: 5, reason: 'nope' } }),
      ctxParams({ id: invRow.id })
    );
    expect(r2.status).toBe(403);
    expect((await prisma.inventory.findUniqueOrThrow({ where: { id: invRow.id } })).availableQuantity).toBe(0);
  });

  it('an inventory manager cannot view or modify administrators or roles', async () => {
    const sa = await adminSession('super', ['SUPER_ADMIN']);
    const inv = await adminSession('inv', ['INVENTORY_MANAGER']);
    const { PUT } = await adminRoles();
    const res = await PUT(
      adminRequest(`/api/admin/admins/${inv.id}/roles`, { method: 'PUT', token: inv.token, body: { roleKeys: ['SUPER_ADMIN'] } }),
      ctxParams({ id: inv.id })
    );
    expect(res.status).toBe(403);
    const res2 = await PUT(adminRequest(`/api/admin/admins/${sa.id}/roles`, { method: 'PUT', token: inv.token, body: { roleKeys: [] } }), ctxParams({ id: sa.id }));
    expect(res2.status).toBe(403);
    expect((await (await adminsRoute()).GET(adminRequest('/api/admin/admins', { token: inv.token }))).status).toBe(403);
    expect((await getAdminContext(inv.token))?.roles).toEqual(['INVENTORY_MANAGER']);
  });

  it('password hashes are never returned by admin APIs', async () => {
    const sa = await adminSession('super', ['SUPER_ADMIN']);
    const res = await (await adminsRoute()).GET(adminRequest('/api/admin/admins', { token: sa.token }));
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).not.toMatch(/passwordHash|\$argon2/);
  });
});

describe('privilege escalation protection', () => {
  it('admins cannot change their own roles or status', async () => {
    const sa = await adminSession('super', ['SUPER_ADMIN']);
    await adminSession('super2', ['SUPER_ADMIN']);
    const { PUT } = await adminRoles();
    const r = await PUT(adminRequest(`/api/admin/admins/${sa.id}/roles`, { method: 'PUT', token: sa.token, body: { roleKeys: [] } }), ctxParams({ id: sa.id }));
    expect(r.status).toBe(403);
    const { POST } = await adminStatus();
    const r2 = await POST(adminRequest(`/api/admin/admins/${sa.id}/status`, { method: 'POST', token: sa.token, body: { status: 'INACTIVE' } }), ctxParams({ id: sa.id }));
    expect(r2.status).toBe(403);
  });

  it('a non-super admin with roles.manage cannot grant SUPER_ADMIN or roles beyond their own permissions', async () => {
    // Custom role holding roles.manage + users.* but not product permissions.
    const sa = await adminSession('super', ['SUPER_ADMIN']);
    const created = await (await rolesRoute()).POST(
      adminRequest('/api/admin/roles', { method: 'POST', token: sa.token, body: { key: 'ROLE_ADMIN', name: 'Role admin', permissionKeys: ['users.view', 'users.manage', 'roles.manage'] } })
    );
    expect(created.status).toBe(201);
    const ra = await adminSession('roleadm', []);
    await prisma.adminUserRole.create({ data: { adminId: ra.id, roleId: (await created.json()).id } });
    // No re-login needed: permissions are loaded from the database on every request.
    const target = await adminSession('target', ['INVENTORY_MANAGER']);
    const { PUT } = await adminRoles();
    const asRa = (keys: string[], confirmPassword?: string) =>
      PUT(adminRequest(`/api/admin/admins/${target.id}/roles`, { method: 'PUT', token: ra.token, body: { roleKeys: keys, confirmPassword } }), ctxParams({ id: target.id }));
    expect((await asRa(['INVENTORY_MANAGER', 'SUPER_ADMIN'])).status).toBe(403);
    expect((await asRa(['INVENTORY_MANAGER', 'PRODUCT_MANAGER'])).status).toBe(403); // lacks product permissions
    expect((await asRa([])).status).toBe(403); // cannot even revoke a role it could not grant
    expect((await getAdminContext(target.token))?.roles).toEqual(['INVENTORY_MANAGER']);
  });

  it('cannot grant permissions you do not hold to a custom role, nor edit a role you hold', async () => {
    const sa = await adminSession('super', ['SUPER_ADMIN']);
    const res = await (await rolesRoute()).POST(
      adminRequest('/api/admin/roles', { method: 'POST', token: sa.token, body: { key: 'LIMITED', name: 'Limited', permissionKeys: ['roles.manage', 'users.view'] } })
    );
    const roleId = (await res.json()).id;
    const lim = await adminSession('lim', []);
    await prisma.adminUserRole.create({ data: { adminId: lim.id, roleId } });
    const { PUT } = await rolePerms();
    const r = await PUT(
      adminRequest(`/api/admin/roles/${roleId}/permissions`, { method: 'PUT', token: lim.token, body: { permissionKeys: ['roles.manage', 'users.view', 'settings.update'] } }),
      ctxParams({ id: roleId })
    );
    expect(r.status).toBe(403);
    const sys = await prisma.role.findUniqueOrThrow({ where: { key: 'ADMIN' } });
    const r2 = await PUT(adminRequest(`/api/admin/roles/${sys.id}/permissions`, { method: 'PUT', token: sa.token, body: { permissionKeys: [] } }), ctxParams({ id: sys.id }));
    expect(r2.status).toBe(403); // system roles are seed-managed
  });

  it('granting SUPER_ADMIN requires password re-entry, and the last super admin is protected', async () => {
    const sa = await adminSession('super', ['SUPER_ADMIN']);
    const pm = await adminSession('prodmgr', ['PRODUCT_MANAGER']);
    const { PUT } = await adminRoles();
    const grant = (confirmPassword?: string) =>
      PUT(adminRequest(`/api/admin/admins/${pm.id}/roles`, { method: 'PUT', token: sa.token, body: { roleKeys: ['PRODUCT_MANAGER', 'SUPER_ADMIN'], confirmPassword } }), ctxParams({ id: pm.id }));
    expect((await grant()).status).toBe(403);
    expect((await grant('wrong-password')).status).toBe(403);
    expect((await grant('correct-horse-battery-staple')).status).toBe(200);
    // Two super admins now: pm (new super) may deactivate sa.
    const { POST } = await adminStatus();
    expect((await POST(adminRequest(`/api/admin/admins/${sa.id}/status`, { method: 'POST', token: pm.token, body: { status: 'INACTIVE' } }), ctxParams({ id: sa.id }))).status).toBe(200);
    // pm is now the only active super admin; removing their own role is a self-change (403) and nobody else can.
    const r = await PUT(adminRequest(`/api/admin/admins/${pm.id}/roles`, { method: 'PUT', token: pm.token, body: { roleKeys: [] } }), ctxParams({ id: pm.id }));
    expect(r.status).toBe(403);
  });

  it('a super admin cannot demote the last active super admin', async () => {
    const sa = await adminSession('super', ['SUPER_ADMIN']);
    const other = await adminSession('other', ['SUPER_ADMIN']);
    // Deactivate the other super admin first so `sa` would become last.
    const { POST } = await adminStatus();
    await POST(adminRequest(`/api/admin/admins/${other.id}/status`, { method: 'POST', token: sa.token, body: { status: 'INACTIVE' } }), ctxParams({ id: other.id }));
    // `sa` is now the last active super admin; the only actor who could deactivate it is itself (self-change forbidden).
    const r = await POST(adminRequest(`/api/admin/admins/${sa.id}/status`, { method: 'POST', token: sa.token, body: { status: 'INACTIVE' } }), ctxParams({ id: sa.id }));
    expect(r.status).toBe(403);
    expect(await prisma.adminUser.count({ where: { status: 'ACTIVE', roles: { some: { role: { key: 'SUPER_ADMIN' } } } } })).toBe(1);
  });
});
