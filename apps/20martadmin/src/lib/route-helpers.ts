import type { NextRequest } from 'next/server';
import { badRequest } from '@20mart/server';

/** Extract a single uploaded file from multipart/form-data. */
export async function readUpload(req: NextRequest): Promise<{ file: Blob; altText: string | null }> {
  const ct = req.headers.get('content-type') ?? '';
  if (!ct.includes('multipart/form-data')) throw badRequest('Expected multipart/form-data');
  // Reject oversized bodies before buffering them (5 MB image + form overhead).
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > 6 * 1024 * 1024) throw badRequest('Image must be 5 MB or smaller');
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || typeof file === 'string') throw badRequest('No file uploaded');
  const alt = form?.get('altText');
  return { file, altText: typeof alt === 'string' ? alt : null };
}

export async function readJson(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw badRequest('Malformed JSON body');
  }
}
