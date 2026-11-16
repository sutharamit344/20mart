import { adminRoute } from '@20mart/server/next';
import { getStoreSettings, onlinePaymentsAvailable, updateStoreSettings } from '@20mart/server';
import { readJson } from '../../../../../lib/route-helpers';

export const GET = adminRoute('delivery.view', async () => ({ settings: await getStoreSettings(), onlinePaymentsConfigured: onlinePaymentsAvailable() }));
export const PATCH = adminRoute('delivery.update', async ({ req, admin }) => updateStoreSettings(admin, await readJson(req)));
