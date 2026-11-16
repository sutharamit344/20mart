import { adminRoute } from '@20mart/server/next';
import { deleteCampaign, getCampaign, updateCampaign } from '@20mart/server';
import { readJson } from '../../../../../lib/route-helpers';

export const GET = adminRoute('campaigns.view', async ({ params }) => getCampaign(params.id));
export const PUT = adminRoute('campaigns.update', async ({ req, admin, params }) => updateCampaign(admin, params.id, await readJson(req)));
export const DELETE = adminRoute('campaigns.delete', async ({ admin, params }) => deleteCampaign(admin, params.id));
