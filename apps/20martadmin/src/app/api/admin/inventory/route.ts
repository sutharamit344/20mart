import { adminRoute } from '@20mart/server/next';
import { inventoryListQuery, inventoryStats, listInventory } from '@20mart/server';

export const GET = adminRoute('inventory.view', async ({ req }) => {
  const [list, stats] = await Promise.all([
    listInventory(inventoryListQuery.parse(Object.fromEntries(req.nextUrl.searchParams))),
    inventoryStats(),
  ]);
  return { ...list, stats };
});
