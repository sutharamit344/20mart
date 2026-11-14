import { adminRoute } from '@20mart/server/next';
import { forbidden, setProductStatus } from '@20mart/server';
import { readJson } from '../../../../../../lib/route-helpers';

// Publish/unpublish is an update; archiving is a delete-class action.
export const POST = adminRoute('products.update', async ({ req, admin, params }) => {
  const body = (await readJson(req)) as { status?: string } | null;
  if (body?.status === 'ARCHIVED' && !admin.permissions.has('products.delete')) throw forbidden('Archiving requires products.delete');
  return setProductStatus(admin, params.id, body);
});
