import { adminRoute } from '@20mart/server/next';
import { addProductImage } from '@20mart/server';
import { json } from '@20mart/server/next';
import { readUpload } from '../../../../../../lib/route-helpers';

export const POST = adminRoute(['products.update', 'media.upload'], async ({ req, admin, params }) => {
  const { file, altText } = await readUpload(req);
  return json(await addProductImage(admin, params.id, file, altText), 201);
});
