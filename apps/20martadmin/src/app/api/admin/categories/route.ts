import { adminRoute } from '@20mart/server/next';
import { categoryListQuery, createCategory, listCategories } from '@20mart/server';
import { json } from '@20mart/server/next';
import { readJson } from '../../../../lib/route-helpers';

export const GET = adminRoute('categories.view', async ({ req }) =>
  listCategories(categoryListQuery.parse(Object.fromEntries(req.nextUrl.searchParams)))
);
export const POST = adminRoute('categories.create', async ({ req, admin }) => json(await createCategory(admin, await readJson(req)), 201));
