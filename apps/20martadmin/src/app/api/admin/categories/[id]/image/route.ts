import { adminRoute } from '@20mart/server/next';
import { setCategoryImage } from '@20mart/server';
import { readUpload } from '../../../../../../lib/route-helpers';

export const POST = adminRoute(['categories.update', 'media.upload'], async ({ req, admin, params }) => {
  const { file } = await readUpload(req);
  return setCategoryImage(admin, params.id, file);
});
