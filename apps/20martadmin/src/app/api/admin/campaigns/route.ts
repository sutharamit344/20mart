import { adminRoute } from '@20mart/server/next';
import { createCampaign, listCampaigns } from '@20mart/server';
import { readJson } from '../../../../lib/route-helpers';
import { json } from '@20mart/server/next';

export const GET = adminRoute('campaigns.view', async ({ req }) => listCampaigns(Object.fromEntries(req.nextUrl.searchParams)));
export const POST = adminRoute('campaigns.create', async ({ req, admin }) => json(await createCampaign(admin, await readJson(req)), 201));
