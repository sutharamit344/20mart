import { prisma, type Prisma } from '@20mart/database';
import { PERMISSIONS, SUPER_ADMIN_ROLE } from '@20mart/shared';
import { z } from 'zod';
import type { AdminContext } from './auth/admin';
import { assertPasswordPolicy, hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from './auth/password';
import { audit } from './audit';
import { AppError, badRequest, conflict, forbidden, notFound } from './errors';
import { idParam } from './catalog/common';

const usernameField = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,32}$/, 'Username: 3–32 chars, letters, numbers, . _ -');
const passwordField = z.string().min(MIN_PASSWORD_LENGTH, `At least ${MIN_PASSWORD_LENGTH} characters`).max(256);
const roleKeys = z.array(z.string().trim().min(2).max(50)).max(10);

export const createAdminInput = z.object({
  username: usernameField,
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().min(2).max(80),
  password: passwordField,
  roleKeys: roleKeys.default([]),
});
export const adminStatusInput = z.object({ status: z.enum(['ACTIVE', 'INACTIVE']) });
export const adminRolesInput = z.object({ roleKeys, confirmPassword: z.string().max(256).optional() });
export const resetPasswordInput = z.object({ password: passwordField });
export const changeOwnPasswordInput = z.object({ currentPassword: z.string().min(1).max(256), newPassword: passwordField });
export const roleInput = z.object({
  key: z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9_]{2,40}$/, 'Key: uppercase letters, numbers, _'),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(200).optional(),
  permissionKeys: z.array(z.string()).max(100).default([]),
});
export const rolePermissionsInput = z.object({ permissionKeys: z.array(z.string()).max(100) });

const isSuper = (ctx: AdminContext) => ctx.roles.includes(SUPER_ADMIN_ROLE);

const adminSelect = {
  id: true,
  username: true,
  email: true,
  name: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  roles: { select: { role: { select: { key: true, name: true } } } },
} satisfies Prisma.AdminUserSelect;

export async function listAdmins() {
  const rows = await prisma.adminUser.findMany({ orderBy: { createdAt: 'asc' }, select: adminSelect });
  return rows.map(({ roles, ...a }) => ({ ...a, roles: roles.map((r) => r.role) }));
}

export async function listRolesWithPermissions() {
  const [roles, permissions] = await Promise.all([
    prisma.role.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        isSystem: true,
        permissions: { select: { permission: { select: { key: true } } } },
        _count: { select: { admins: true } },
      },
    }),
    prisma.permission.findMany({ orderBy: [{ group: 'asc' }, { key: 'asc' }], select: { key: true, group: true, description: true } }),
  ]);
  return {
    roles: roles.map(({ permissions: p, _count, ...r }) => ({ ...r, adminCount: _count.admins, permissions: p.map((x) => x.permission.key) })),
    permissions,
  };
}

/** The actor may only grant/revoke roles whose permissions they already hold. */
async function assertCanManageRoles(actor: AdminContext, keys: string[]) {
  if (!keys.length) return [];
  const roles = await prisma.role.findMany({
    where: { key: { in: keys } },
    select: { id: true, key: true, permissions: { select: { permission: { select: { key: true } } } } },
  });
  const found = new Set(roles.map((r) => r.key));
  const unknown = keys.filter((k) => !found.has(k));
  if (unknown.length) throw badRequest(`Unknown role(s): ${unknown.join(', ')}`);
  for (const role of roles) {
    if (role.key === SUPER_ADMIN_ROLE && !isSuper(actor)) throw forbidden('Only a Super Admin can grant or revoke Super Admin');
    const lacking = role.permissions.map((p) => p.permission.key).filter((k) => !actor.permissions.has(k));
    if (lacking.length) throw forbidden(`You cannot assign the ${role.key} role because it has permissions you do not hold`);
  }
  return roles;
}

async function activeSuperAdminCount(excludingId?: string) {
  return prisma.adminUser.count({
    where: { status: 'ACTIVE', id: excludingId ? { not: excludingId } : undefined, roles: { some: { role: { key: SUPER_ADMIN_ROLE } } } },
  });
}

async function assertConfirmPassword(actor: AdminContext, password: string | undefined) {
  const me = await prisma.adminUser.findUnique({ where: { id: actor.admin.id }, select: { passwordHash: true } });
  if (!password || !me || !(await verifyPassword(me.passwordHash, password))) {
    throw new AppError(403, 'REAUTH_REQUIRED', 'Please confirm your password to grant Super Admin');
  }
}

export async function createAdmin(actor: AdminContext, raw: unknown) {
  const input = createAdminInput.parse(raw);
  if (input.roleKeys.length && !actor.permissions.has('roles.manage')) throw forbidden('Assigning roles requires roles.manage');
  const roles = await assertCanManageRoles(actor, input.roleKeys);
  if (input.roleKeys.includes(SUPER_ADMIN_ROLE)) throw forbidden('Create the account first, then grant Super Admin with password confirmation');
  const passwordHash = await hashPassword(input.password);
  return prisma.$transaction(async (tx) => {
    const a = await tx.adminUser.create({
      data: {
        username: input.username,
        email: input.email,
        name: input.name,
        passwordHash,
        roles: { create: roles.map((r) => ({ roleId: r.id, assignedById: actor.admin.id })) },
      },
      select: { id: true, username: true },
    });
    await audit(tx, actor, {
      action: 'Created admin user',
      category: 'USER_MANAGEMENT',
      entityType: 'AdminUser',
      entityId: a.id,
      details: `${a.username} roles=[${input.roleKeys.join(', ')}]`,
    });
    return a;
  });
}

export async function setAdminStatus(actor: AdminContext, adminId: string, raw: unknown) {
  idParam.parse(adminId);
  const { status } = adminStatusInput.parse(raw);
  if (adminId === actor.admin.id) throw forbidden('You cannot change your own account status');
  const target = await prisma.adminUser.findUnique({ where: { id: adminId }, select: { username: true, roles: { select: { role: { select: { key: true } } } } } });
  if (!target) throw notFound('Admin user');
  const targetIsSuper = target.roles.some((r) => r.role.key === SUPER_ADMIN_ROLE);
  if (targetIsSuper && !isSuper(actor)) throw forbidden('Only a Super Admin can change another Super Admin');
  if (status === 'INACTIVE' && targetIsSuper && (await activeSuperAdminCount(adminId)) === 0) {
    throw conflict('You cannot deactivate the last active Super Admin');
  }
  await prisma.$transaction(async (tx) => {
    await tx.adminUser.update({ where: { id: adminId }, data: { status, ...(status === 'ACTIVE' ? { failedLoginCount: 0, lockedUntil: null } : {}) } });
    // Deactivation takes effect immediately: kill all live sessions.
    if (status === 'INACTIVE') await tx.adminSession.deleteMany({ where: { adminId } });
    await audit(tx, actor, { action: status === 'ACTIVE' ? 'Activated admin' : 'Deactivated admin', category: 'USER_MANAGEMENT', entityType: 'AdminUser', entityId: adminId, details: target.username });
  });
}

export async function setAdminRoles(actor: AdminContext, adminId: string, raw: unknown) {
  idParam.parse(adminId);
  const input = adminRolesInput.parse(raw);
  if (adminId === actor.admin.id) throw forbidden('You cannot change your own roles');
  const target = await prisma.adminUser.findUnique({
    where: { id: adminId },
    select: { username: true, status: true, roles: { select: { role: { select: { key: true } } } } },
  });
  if (!target) throw notFound('Admin user');
  const current = target.roles.map((r) => r.role.key);
  const desired = [...new Set(input.roleKeys)];
  const added = desired.filter((k) => !current.includes(k));
  const removed = current.filter((k) => !desired.includes(k));
  // The actor must be entitled to every role they add OR remove.
  const addedRoles = await assertCanManageRoles(actor, added);
  await assertCanManageRoles(actor, removed);
  if (added.includes(SUPER_ADMIN_ROLE)) await assertConfirmPassword(actor, input.confirmPassword);
  if (removed.includes(SUPER_ADMIN_ROLE) && target.status === 'ACTIVE' && (await activeSuperAdminCount(adminId)) === 0) {
    throw conflict('You cannot remove the last active Super Admin');
  }
  await prisma.$transaction(async (tx) => {
    if (removed.length) await tx.adminUserRole.deleteMany({ where: { adminId, role: { key: { in: removed } } } });
    if (addedRoles.length) {
      await tx.adminUserRole.createMany({ data: addedRoles.map((r) => ({ adminId, roleId: r.id, assignedById: actor.admin.id })) });
    }
    // Force re-authentication so the new privilege set is picked up cleanly.
    if (removed.length) await tx.adminSession.deleteMany({ where: { adminId } });
    await audit(tx, actor, {
      action: 'Changed admin roles',
      category: 'ROLE',
      entityType: 'AdminUser',
      entityId: adminId,
      details: `${target.username}: +[${added.join(', ')}] -[${removed.join(', ')}]`,
    });
  });
}

export async function resetAdminPassword(actor: AdminContext, adminId: string, raw: unknown) {
  idParam.parse(adminId);
  const { password } = resetPasswordInput.parse(raw);
  if (adminId === actor.admin.id) throw badRequest('Use “Change my password” for your own account');
  const target = await prisma.adminUser.findUnique({ where: { id: adminId }, select: { username: true, roles: { select: { role: { select: { key: true } } } } } });
  if (!target) throw notFound('Admin user');
  if (target.roles.some((r) => r.role.key === SUPER_ADMIN_ROLE) && !isSuper(actor)) throw forbidden('Only a Super Admin can reset a Super Admin password');
  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    await tx.adminUser.update({ where: { id: adminId }, data: { passwordHash, passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null } });
    await tx.adminSession.deleteMany({ where: { adminId } });
    await audit(tx, actor, { action: 'Reset admin password', category: 'USER_MANAGEMENT', entityType: 'AdminUser', entityId: adminId, details: target.username });
  });
}

export async function changeOwnPassword(actor: AdminContext, raw: unknown) {
  const { currentPassword, newPassword } = changeOwnPasswordInput.parse(raw);
  assertPasswordPolicy(newPassword);
  const me = await prisma.adminUser.findUnique({ where: { id: actor.admin.id }, select: { passwordHash: true } });
  if (!me || !(await verifyPassword(me.passwordHash, currentPassword))) throw new AppError(400, 'BAD_PASSWORD', 'Current password is incorrect');
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction(async (tx) => {
    await tx.adminUser.update({ where: { id: actor.admin.id }, data: { passwordHash, passwordChangedAt: new Date() } });
    // Revoke every other session; keep the current one.
    await tx.adminSession.deleteMany({ where: { adminId: actor.admin.id, id: { not: actor.sessionId } } });
    await audit(tx, actor, { action: 'Changed own password', category: 'USER_MANAGEMENT', entityType: 'AdminUser', entityId: actor.admin.id, details: actor.admin.username });
  });
}

const knownPermission = (k: string) => Object.prototype.hasOwnProperty.call(PERMISSIONS, k);

function assertGrantable(actor: AdminContext, keys: string[]) {
  const unknown = keys.filter((k) => !knownPermission(k));
  if (unknown.length) throw badRequest(`Unknown permission(s): ${unknown.join(', ')}`);
  const lacking = keys.filter((k) => !actor.permissions.has(k));
  if (lacking.length) throw forbidden(`You cannot grant permissions you do not hold: ${lacking.join(', ')}`);
}

export async function createRole(actor: AdminContext, raw: unknown) {
  const input = roleInput.parse(raw);
  assertGrantable(actor, input.permissionKeys);
  const perms = await prisma.permission.findMany({ where: { key: { in: input.permissionKeys } }, select: { id: true } });
  return prisma.$transaction(async (tx) => {
    const r = await tx.role.create({
      data: { key: input.key, name: input.name, description: input.description, isSystem: false, permissions: { create: perms.map((p) => ({ permissionId: p.id })) } },
      select: { id: true, key: true },
    });
    await audit(tx, actor, { action: 'Created role', category: 'ROLE', entityType: 'Role', entityId: r.id, details: `${r.key}: ${input.permissionKeys.join(', ')}` });
    return r;
  });
}

/** Edit a custom role's permissions. System roles are managed by the seed. */
export async function updateRolePermissions(actor: AdminContext, roleId: string, raw: unknown) {
  idParam.parse(roleId);
  const { permissionKeys } = rolePermissionsInput.parse(raw);
  const role = await prisma.role.findUnique({ where: { id: roleId }, select: { key: true, isSystem: true, permissions: { select: { permission: { select: { key: true } } } } } });
  if (!role) throw notFound('Role');
  if (role.isSystem) throw forbidden('System roles cannot be edited here');
  if (actor.roles.includes(role.key)) throw forbidden('You cannot edit a role you hold');
  const current = role.permissions.map((p) => p.permission.key);
  const desired = [...new Set(permissionKeys)];
  // Must hold every permission being added or removed.
  assertGrantable(actor, [...desired.filter((k) => !current.includes(k)), ...current.filter((k) => !desired.includes(k))]);
  const perms = await prisma.permission.findMany({ where: { key: { in: desired } }, select: { id: true } });
  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId } });
    await tx.rolePermission.createMany({ data: perms.map((p) => ({ roleId, permissionId: p.id })) });
    await audit(tx, actor, { action: 'Updated role permissions', category: 'ROLE', entityType: 'Role', entityId: roleId, details: `${role.key}: ${desired.join(', ')}` });
  });
}
