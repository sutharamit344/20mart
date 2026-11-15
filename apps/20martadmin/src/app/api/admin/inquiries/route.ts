import { adminRoute } from '@20mart/server/next';
import { listInquiries } from '@20mart/server';

export const GET = adminRoute('inquiries.view', async ({ req }) => listInquiries(Object.fromEntries(req.nextUrl.searchParams)));
