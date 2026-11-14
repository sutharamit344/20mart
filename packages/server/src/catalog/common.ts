import { z } from 'zod';
import { SLUG_REGEX } from '@20mart/shared';

export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional().transform((v) => v || undefined),
});

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

export const slugField = z.string().trim().toLowerCase().min(2).max(80).regex(SLUG_REGEX, 'Use lowercase letters, numbers and hyphens');

export const catalogStatus = z.enum(['ACTIVE', 'INACTIVE']);

export const idParam = z.string().uuid('Invalid id');
