import { adminRoute } from '@20mart/server/next';
import { getStockHistory } from '@20mart/server';

export const GET = adminRoute('inventory.view', async ({ req, params }) => {
  const page = Math.max(1, Math.min(1000, Number(req.nextUrl.searchParams.get('page')) || 1));
  return getStockHistory(params.id, page, 20);
});
