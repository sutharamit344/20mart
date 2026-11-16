import { adminRoute } from '@20mart/server/next';
import { listCustomersAdmin } from '@20mart/server';

export const GET = adminRoute('customers.view', async ({ req }) => listCustomersAdmin(Object.fromEntries(req.nextUrl.searchParams)));
