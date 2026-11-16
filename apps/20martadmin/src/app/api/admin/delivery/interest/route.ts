import { adminRoute } from '@20mart/server/next';
import { deliveryInterestSummary } from '@20mart/server';

export const GET = adminRoute('delivery.view', async () => deliveryInterestSummary());
