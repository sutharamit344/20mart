import { adminRoute } from '@20mart/server/next';
import { updateInquiry } from '@20mart/server';
import { readJson } from '../../../../../lib/route-helpers';

export const PATCH = adminRoute('inquiries.manage', async ({ req, admin, params }) => updateInquiry(admin, params.id, await readJson(req)));
