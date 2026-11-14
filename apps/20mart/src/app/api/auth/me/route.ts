import { type NextRequest } from 'next/server';
import { customerSessionCookie, getCustomerBySessionToken } from '@20mart/server';
import { json } from '@20mart/server/next';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getCustomerBySessionToken(req.cookies.get(customerSessionCookie().name)?.value);
  return json({ user });
}
