import { adminRoute } from '@20mart/server/next';
import { setBrandLogo } from '@20mart/server';
import { readUpload } from '../../../../../../lib/route-helpers';

export const POST = adminRoute(['brands.update', 'media.upload'], async ({ req, admin, params }) => {
  const { file } = await readUpload(req);
  return setBrandLogo(admin, params.id, file);
});
