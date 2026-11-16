import { adminRoute } from '@20mart/server/next';
import { setCampaignBanner } from '@20mart/server';
import { readUpload } from '../../../../../../lib/route-helpers';

export const POST = adminRoute(['campaigns.update', 'media.upload'], async ({ req, admin, params }) => {
  const { file } = await readUpload(req);
  return setCampaignBanner(admin, params.id, file);
});
