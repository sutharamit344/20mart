import { adminRoute, parseJson } from '@20mart/server/next';
import { analyticsSettingsInput, getAnalyticsSettings, updateAnalyticsSettings } from '@20mart/server';

export const dynamic = 'force-dynamic';

export const GET = adminRoute('analytics.view', async () => getAnalyticsSettings({ fresh: true }));
export const PUT = adminRoute('analytics.manage', async ({ req, admin }) => updateAnalyticsSettings(admin, await parseJson(req, analyticsSettingsInput)));
