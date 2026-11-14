import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { env } from '@20mart/server';
import { safeEqual } from '@20mart/server/crypto';

const body = z.object({ paths: z.array(z.string().regex(/^\/[a-z0-9/_-]*$/i).max(200)).max(20) });

/** Server-to-server hook used by the admin app after catalog/inventory changes. */
export async function POST(req: NextRequest) {
  const secret = env().REVALIDATE_SECRET;
  if (!secret || !safeEqual(req.headers.get('x-revalidate-secret') ?? '', secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  for (const p of parsed.data.paths) revalidatePath(p);
  revalidatePath('/', 'layout');
  revalidateTag('catalog');
  return NextResponse.json({ revalidated: parsed.data.paths.length });
}
