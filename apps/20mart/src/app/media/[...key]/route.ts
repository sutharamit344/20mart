import { NextResponse, type NextRequest } from 'next/server';
import { env, isValidStorageKey, readLocalObject } from '@20mart/server';

const TYPES: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif' };

/** Serves locally stored uploads (STORAGE_DRIVER=local). Production should use S3/R2 + CDN. */
export async function GET(_req: NextRequest, { params }: { params: { key: string[] } }) {
  if (env().STORAGE_DRIVER !== 'local') return new NextResponse(null, { status: 404 });
  const key = params.key.join('/');
  if (!isValidStorageKey(key)) return new NextResponse(null, { status: 404 });
  try {
    const data = await readLocalObject(key);
    const ext = key.split('.').pop()!;
    return new NextResponse(data, {
      headers: {
        'content-type': TYPES[ext] ?? 'application/octet-stream',
        'cache-control': 'public, max-age=31536000, immutable',
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
