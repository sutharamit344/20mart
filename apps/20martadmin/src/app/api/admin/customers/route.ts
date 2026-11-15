import { adminRoute } from '@20mart/server/next';
import { listCustomers } from '@20mart/server';

export const GET = adminRoute('customers.view', async ({ req }) => listCustomers(Object.fromEntries(req.nextUrl.searchParams)));
