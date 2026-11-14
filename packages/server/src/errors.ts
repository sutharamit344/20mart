import { Prisma } from '@20mart/database';
import { ZodError } from 'zod';

/** Error with an HTTP status and a stable machine-readable code. Safe to show to clients. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, details?: unknown) => new AppError(400, 'BAD_REQUEST', message, details);
export const unauthorized = (message = 'Authentication required') => new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'You do not have permission to perform this action') =>
  new AppError(403, 'FORBIDDEN', message);
export const notFound = (what = 'Resource') => new AppError(404, 'NOT_FOUND', `${what} not found`);
export const conflict = (message: string, details?: unknown) => new AppError(409, 'CONFLICT', message, details);
export const tooManyRequests = (message = 'Too many requests. Please try again later.') =>
  new AppError(429, 'RATE_LIMITED', message);

const FIELD_LABELS: Record<string, string> = {
  slug: 'slug',
  sku: 'SKU',
  username: 'username',
  email: 'email',
  amountPaise: 'price point',
};

/** Convert any thrown value into an AppError without leaking internals. */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) {
    return new AppError(400, 'VALIDATION_ERROR', 'Some fields are invalid', err.flatten());
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[] | string | undefined) ?? [];
      const fields = (Array.isArray(target) ? target : [target]).map((f) => FIELD_LABELS[f] ?? f);
      return conflict(`A record with this ${fields.join(', ') || 'value'} already exists`, { fields });
    }
    if (err.code === 'P2025') return notFound();
    if (err.code === 'P2003') return conflict('This record is referenced by other data and cannot be changed');
    if (err.code === 'P2034') return conflict('The record was modified concurrently. Please retry.');
  }
  // Postgres CHECK constraint violations surface as unknown request errors.
  const msg = (err as Error)?.message ?? '';
  if (/violates check constraint "Inventory_quantities_check"/.test(msg)) {
    return conflict('Insufficient stock for this operation');
  }
  if (/violates check constraint "(Product|ProductVariant)_price_check"/.test(msg)) {
    return badRequest('Selling price must be greater than zero and not exceed MRP');
  }
  return new AppError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
}
