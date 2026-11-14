import { adminRoute } from '@20mart/server/next';
import { z } from 'zod';
import { moveCategory } from '@20mart/server';
import { readJson } from '../../../../../../lib/route-helpers';

const body = z.object({ direction: z.enum(['up', 'down']) });
export const POST = adminRoute('categories.update', async ({ req, admin, params }) => {
  await moveCategory(admin, params.id, body.parse(await readJson(req)).direction);
  return { ok: true };
});
