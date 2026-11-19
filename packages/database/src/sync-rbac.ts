/**
 * Access-control sync ONLY: permissions, system roles and role→permission grants.
 *   pnpm --filter @20mart/database exec tsx ./src/sync-rbac.ts
 *
 * Production builds run this instead of the full seed (see scripts/vercel-migrate.mjs), so
 * newly introduced permissions (e.g. `analytics.manage`) reach production without the seed's
 * catalog/coupon steps ever touching live catalog data.
 *
 * Same rules as the RBAC part of seed.ts (kept identical on purpose):
 *  - permissions are created or have their group/description refreshed; never deleted, except
 *    keys listed in RETIRED_PERMISSIONS, whose grants first move to their replacements;
 *  - SUPER_ADMIN always holds every permission;
 *  - other system roles get their defaults when first created and, afterwards, only permissions
 *    that are new in this run, so role edits made in the admin are preserved.
 * Idempotent. Never touches products, categories, price points, coupons, stock or orders.
 */
import { PrismaClient } from '@prisma/client';
import { PERMISSIONS, RETIRED_PERMISSIONS, ROLE_DEFINITIONS, ROLE_KEYS, SUPER_ADMIN_ROLE, type PermissionKey } from '@20mart/shared';

const prisma = new PrismaClient();

async function syncPermissions() {
  const created = new Set<string>();
  for (const [key, meta] of Object.entries(PERMISSIONS)) {
    const existing = await prisma.permission.findUnique({ where: { key }, select: { id: true } });
    if (existing) await prisma.permission.update({ where: { key }, data: { group: meta.group, description: meta.description } });
    else {
      await prisma.permission.create({ data: { key, group: meta.group, description: meta.description } });
      created.add(key);
    }
  }
  return created;
}

async function syncRoles(newPermissions: Set<string>) {
  const idByKey = new Map((await prisma.permission.findMany({ select: { id: true, key: true } })).map((p) => [p.key, p.id]));
  let grants = 0;
  for (const roleKey of ROLE_KEYS) {
    const def = ROLE_DEFINITIONS[roleKey];
    const existing = await prisma.role.findUnique({ where: { key: roleKey }, select: { id: true } });
    const role = existing
      ? await prisma.role.update({ where: { key: roleKey }, data: { name: def.name, description: def.description, isSystem: true }, select: { id: true } })
      : await prisma.role.create({ data: { key: roleKey, name: def.name, description: def.description, isSystem: true }, select: { id: true } });
    let toGrant: PermissionKey[];
    if (roleKey === SUPER_ADMIN_ROLE) toGrant = Object.keys(PERMISSIONS) as PermissionKey[];
    else if (!existing) toGrant = def.permissions;
    else toGrant = def.permissions.filter((p) => newPermissions.has(p));
    if (toGrant.length) {
      const r = await prisma.rolePermission.createMany({ data: toGrant.map((k) => ({ roleId: role.id, permissionId: idByKey.get(k)! })), skipDuplicates: true });
      grants += r.count;
    }
  }
  return grants;
}

async function retirePermissions() {
  for (const [oldKey, replacements] of Object.entries(RETIRED_PERMISSIONS)) {
    const old = await prisma.permission.findUnique({ where: { key: oldKey }, select: { id: true, roles: { select: { roleId: true } } } });
    if (!old) continue;
    const repl = await prisma.permission.findMany({ where: { key: { in: replacements } }, select: { id: true } });
    await prisma.$transaction([
      prisma.rolePermission.createMany({ data: old.roles.flatMap((r) => repl.map((p) => ({ roleId: r.roleId, permissionId: p.id }))), skipDuplicates: true }),
      prisma.rolePermission.deleteMany({ where: { permissionId: old.id } }),
      prisma.permission.delete({ where: { id: old.id } }),
    ]);
    console.log(`[sync-rbac] retired ${oldKey} → ${replacements.join(', ')} (${old.roles.length} grants moved)`);
  }
}

async function main() {
  const created = await syncPermissions();
  const grants = await syncRoles(created);
  await retirePermissions();
  console.log(`[sync-rbac] done: ${created.size} new permission(s)${created.size ? ` (${[...created].join(', ')})` : ''}, ${grants} new role grant(s)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
