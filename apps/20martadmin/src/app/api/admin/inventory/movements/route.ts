import { adminRoute } from '@20mart/server/next';
import { listMovements, movementListQuery } from '@20mart/server';

export const GET = adminRoute('inventory.view', async ({ req }) => listMovements(movementListQuery.parse(Object.fromEntries(req.nextUrl.searchParams))));
