import { adminRoute } from '@20mart/server/next';
import { deleteMapping } from '@20mart/server';

export const DELETE = adminRoute(['warehouses.manage', 'delivery.update'], async ({ admin, params }) => deleteMapping(admin, params.id, params.mappingId));
