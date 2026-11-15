import { adminRoute } from '@20mart/server/next';
import { deletePincode } from '@20mart/server';

export const DELETE = adminRoute('delivery.manage', async ({ admin, params }) => {
  await deletePincode(admin, params.pincode);
  return { ok: true };
});
