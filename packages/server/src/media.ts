import { randomUUID } from 'node:crypto';
import { imageSize } from 'image-size';
import { badRequest } from './errors';
import { storage } from './storage';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MIN_IMAGE_DIMENSION = 100;
export const MAX_IMAGE_DIMENSION = 5000;
export type ImagePurpose = 'products' | 'categories' | 'brands';

const TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
} as const;
type AllowedMime = keyof typeof TYPES;

/** Detect the real type from magic bytes (never trust the declared MIME type alone). */
export function sniffImageType(b: Uint8Array): AllowedMime | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a)
    return 'image/png';
  const ascii = (s: number, e: number) => String.fromCharCode(...b.slice(s, e));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (ascii(4, 8) === 'ftyp' && ['avif', 'avis'].includes(ascii(8, 12))) return 'image/avif';
  return null;
}

export interface ValidatedImage {
  bytes: Uint8Array;
  mimeType: AllowedMime;
  width: number;
  height: number;
  sizeBytes: number;
}

export function validateImage(bytes: Uint8Array, declaredType: string | undefined): ValidatedImage {
  if (bytes.byteLength === 0) throw badRequest('The file is empty');
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw badRequest('Image must be 5 MB or smaller');
  const sniffed = sniffImageType(bytes);
  if (!sniffed) throw badRequest('Only JPEG, PNG, WebP or AVIF images are allowed');
  if (declaredType && declaredType !== sniffed) throw badRequest('File content does not match its declared type');
  let dims: { width?: number; height?: number };
  try {
    dims = imageSize(bytes);
  } catch {
    throw badRequest('Image could not be read');
  }
  const { width = 0, height = 0 } = dims;
  if (width < MIN_IMAGE_DIMENSION || height < MIN_IMAGE_DIMENSION) {
    throw badRequest(`Image must be at least ${MIN_IMAGE_DIMENSION}×${MIN_IMAGE_DIMENSION} pixels`);
  }
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    throw badRequest(`Image must be at most ${MAX_IMAGE_DIMENSION}×${MAX_IMAGE_DIMENSION} pixels`);
  }
  return { bytes, mimeType: sniffed, width, height, sizeBytes: bytes.byteLength };
}

/** Validate and store an uploaded image. Resolves only after storage confirms the write. */
export async function uploadImage(file: Blob, purpose: ImagePurpose) {
  if (file.size > MAX_IMAGE_BYTES) throw badRequest('Image must be 5 MB or smaller');
  const img = validateImage(new Uint8Array(await file.arrayBuffer()), file.type || undefined);
  const now = new Date();
  const key = `${purpose}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}.${TYPES[img.mimeType]}`;
  const stored = await storage().put(key, img.bytes, img.mimeType);
  return { ...stored, width: img.width, height: img.height, mimeType: img.mimeType, sizeBytes: img.sizeBytes };
}

/** Best-effort removal of an object we own; failures are logged, never thrown. */
export async function deleteStoredImage(key: string | null | undefined) {
  if (!key) return;
  try {
    await storage().delete(key);
  } catch (e) {
    console.warn('[media] orphaned object could not be deleted:', key, (e as Error).message);
  }
}
