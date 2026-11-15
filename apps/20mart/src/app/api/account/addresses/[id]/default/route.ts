import { customerRoute } from '@20mart/server/next';
import { setDefaultAddress } from '@20mart/server';

export const POST = customerRoute({ auth: 'required' }, async ({ params, customer }) => {
  await setDefaultAddress(customer!.id, params.id);
  return { ok: true };
});
