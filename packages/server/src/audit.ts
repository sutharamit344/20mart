import { prisma, type Prisma } from '@20mart/database';
import type { AdminContext } from './auth/admin';

type Tx = Prisma.TransactionClient | typeof prisma;

export type AuditCategory = 'AUTH' | 'PRODUCT' | 'CATEGORY' | 'BRAND' | 'INVENTORY' | 'MEDIA' | 'USER_MANAGEMENT' | 'ROLE';

export async function audit(
  tx: Tx,
  actor: AdminContext,
  entry: { action: string; category: AuditCategory; entityType?: string; entityId?: string; details: string }
) {
  await tx.adminAuditLog.create({
    data: {
      adminId: actor.admin.id,
      adminName: actor.admin.name,
      action: entry.action.slice(0, 120),
      category: entry.category,
      entityType: entry.entityType,
      entityId: entry.entityId,
      details: entry.details.slice(0, 1000),
    },
  });
}

export async function listAuditLogs(params: { page: number; pageSize: number; category?: string }) {
  const where = params.category ? { category: params.category } : {};
  const [items, total] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      select: { id: true, adminName: true, action: true, category: true, details: true, createdAt: true },
    }),
    prisma.adminAuditLog.count({ where }),
  ]);
  return { items, total, page: params.page, pageSize: params.pageSize };
}
