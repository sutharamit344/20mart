import { adminRoute } from '@20mart/server/next';
import { setPrimaryImage } from '@20mart/server';

export const POST = adminRoute('products.update', async ({ admin, params }) => {
  await setPrimaryImage(admin, params.id, params.imageId);
  return { ok: true };
});
