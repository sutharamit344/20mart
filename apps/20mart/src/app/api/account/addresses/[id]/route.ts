import { customerRoute } from '@20mart/server/next';
import { deleteAddress, updateAddress } from '@20mart/server';

export const PATCH = customerRoute({ auth: 'required' }, async ({ req, params, customer }) => updateAddress(customer!.id, params.id, await req.json().catch(() => ({}))));
export const DELETE = customerRoute({ auth: 'required' }, async ({ params, customer }) => {
  await deleteAddress(customer!.id, params.id);
  return { ok: true };
});
