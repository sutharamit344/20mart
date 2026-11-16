import { adminRoute } from '@20mart/server/next';
import { getCustomerAdmin } from '@20mart/server';

/** Addresses and order history are delivery/order data: they need orders.view as well. */
export const GET = adminRoute('customers.view', async ({ admin, params }) =>
  getCustomerAdmin(params.id, { includeAddresses: admin.permissions.has('orders.view'), includeOrders: admin.permissions.has('orders.view') })
);
