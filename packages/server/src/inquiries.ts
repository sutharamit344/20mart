import { randomInt } from 'node:crypto';
import { prisma, Prisma } from '@20mart/database';
import { z } from 'zod';
import type { AdminContext } from './auth/admin';
import { audit } from './audit';
import { AppError, notFound } from './errors';

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ticket = () => 'INQ-' + Array.from({ length: 6 }, () => CROCKFORD[randomInt(32)]).join('');

export const SUBJECTS = ['Order & Delivery Inquiry', 'Product Information', 'Returns & Refunds', 'Bulk / Business Order', 'Feedback & Suggestions', 'Other'] as const;

export const inquiryInput = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(254),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, '').replace(/^(\+91|91|0)(?=[6-9]\d{9}$)/, ''))
    .pipe(z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'))
    .optional()
    .or(z.literal('').transform(() => undefined)),
  subject: z.string().trim().min(2).max(120).default('Order & Delivery Inquiry'),
  message: z.string().trim().min(10, 'Please write at least 10 characters').max(2000),
});

/** Store a contact-form message. Priority is derived on the server, never taken from the client. */
export async function createInquiry(raw: unknown, userId: string | null = null) {
  const input = inquiryInput.parse(raw);
  const priority = /damage|broken|refund|bulk|business|wrong item/i.test(`${input.subject} ${input.message}`) ? 'HIGH' : 'NORMAL';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.contactInquiry.create({
        data: { ...input, phone: input.phone ?? null, userId, priority, ticketNumber: ticket() },
        select: { ticketNumber: true },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
      throw e;
    }
  }
  throw new AppError(500, 'INQUIRY_FAILED', 'Could not send your message. Please try again.');
}

const STATUSES = ['NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
const PRIORITIES = ['LOW', 'NORMAL', 'HIGH'] as const;

export const inquiryListQuery = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(80).optional().transform((v) => v || undefined),
  status: z.enum(STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
});

export async function listInquiries(raw: unknown) {
  const q = inquiryListQuery.parse(raw);
  const where: Prisma.ContactInquiryWhereInput = {
    ...(q.status ? { status: q.status } : {}),
    ...(q.priority ? { priority: q.priority } : {}),
    ...(q.q
      ? {
          OR: [
            { ticketNumber: { contains: q.q.toUpperCase() } },
            { name: { contains: q.q, mode: 'insensitive' } },
            { email: { contains: q.q.toLowerCase() } },
            { subject: { contains: q.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [items, total, newCount] = await Promise.all([
    prisma.contactInquiry.findMany({ where, orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
    prisma.contactInquiry.count({ where }),
    prisma.contactInquiry.count({ where: { status: 'NEW' } }),
  ]);
  return { items, total, newCount, page: q.page, pageSize: q.pageSize };
}

export const countNewInquiries = () => prisma.contactInquiry.count({ where: { status: 'NEW' } });

export const inquiryUpdate = z
  .object({
    status: z.enum(STATUSES).optional(),
    priority: z.enum(PRIORITIES).optional(),
    adminNotes: z.string().trim().max(2000).nullish(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export async function updateInquiry(actor: AdminContext, id: string, raw: unknown) {
  z.string().uuid().parse(id);
  const input = inquiryUpdate.parse(raw);
  const existing = await prisma.contactInquiry.findUnique({ where: { id }, select: { ticketNumber: true } });
  if (!existing) throw notFound('Inquiry');
  return prisma.$transaction(async (tx) => {
    const row = await tx.contactInquiry.update({ where: { id }, data: { ...input, adminNotes: input.adminNotes === undefined ? undefined : input.adminNotes || null } });
    await audit(tx, actor, {
      action: 'Updated customer inquiry',
      category: 'USER_MANAGEMENT',
      entityType: 'ContactInquiry',
      entityId: id,
      details: `${existing.ticketNumber}: ${Object.keys(input).join(', ')}${input.status ? ` → ${input.status}` : ''}`,
    });
    return row;
  });
}
