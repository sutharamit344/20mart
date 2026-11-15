import { adminRoute } from '@20mart/server/next';
import { getStoreSettings, onlinePaymentsAvailable, updateStoreSettings } from '@20mart/server';
import { readJson } from '../../../../../lib/route-helpers';

export const GET = adminRoute('delivery.manage', async () => ({ settings: await getStoreSettings(), onlinePaymentsConfigured: onlinePaymentsAvailable() }));
export const PATCH = adminRoute('delivery.manage', async ({ req, admin }) => updateStoreSettings(admin, await readJson(req)));
