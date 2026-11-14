import { adminRoute } from '@20mart/server/next';
import { getDashboardStats } from '@20mart/server';

export const GET = adminRoute('dashboard.view', async () => getDashboardStats());
