import { mkdir, writeFile, stat, unlink, readFile } from 'node:fs/promises';
import path from 'node:path';
import { AwsClient } from 'aws4fetch';
import { env } from './env';
import { AppError } from './errors';

export interface StoredObject {
  key: string;
  url: string;
}

export interface StorageDriver {
  /** Resolves only after the provider confirms the object exists with the expected size. */
  put(key: string, body: Uint8Array, contentType: string): Promise<StoredObject>;
  delete(key: string): Promise<void>;
  publicUrl(key: string): string;
}

const KEY_RE = /^[a-z0-9][a-z0-9/_-]*\.(jpg|png|webp|avif)$/;
export const isValidStorageKey = (key: string) => KEY_RE.test(key) && !key.includes('..') && !key.includes('//');

function publicBase() {
  const base = env().STORAGE_PUBLIC_BASE_URL;
  if (!base) throw new AppError(500, 'STORAGE_NOT_CONFIGURED', 'Image storage is not configured');
  return base.replace(/\/$/, '');
}

function localRoot() {
  const dir = env().STORAGE_LOCAL_DIR;
  if (!dir) throw new AppError(500, 'STORAGE_NOT_CONFIGURED', 'Image storage is not configured');
  return path.resolve(dir);
}

/** Resolve a key inside the local root, refusing traversal. */
export function resolveLocalPath(key: string) {
  if (!isValidStorageKey(key)) throw new AppError(400, 'BAD_KEY', 'Invalid storage key');
  const root = localRoot();
  const full = path.resolve(root, key);
  if (!full.startsWith(root + path.sep)) throw new AppError(400, 'BAD_KEY', 'Invalid storage key');
  return full;
}

const localDriver: StorageDriver = {
  async put(key, body) {
    const full = resolveLocalPath(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, body, { flag: 'wx' });
    const s = await stat(full);
    if (s.size !== body.byteLength) throw new AppError(502, 'STORAGE_WRITE_FAILED', 'Image could not be stored');
    return { key, url: this.publicUrl(key) };
  },
  async delete(key) {
    await unlink(resolveLocalPath(key)).catch((e: NodeJS.ErrnoException) => {
      if (e.code !== 'ENOENT') throw e;
    });
  },
  publicUrl: (key) => `${publicBase()}/${key}`,
};

function s3Client() {
  const e = env();
  if (!e.S3_ENDPOINT || !e.S3_BUCKET || !e.S3_ACCESS_KEY_ID || !e.S3_SECRET_ACCESS_KEY) {
    throw new AppError(500, 'STORAGE_NOT_CONFIGURED', 'S3 storage is not configured');
  }
  return {
    client: new AwsClient({
      accessKeyId: e.S3_ACCESS_KEY_ID,
      secretAccessKey: e.S3_SECRET_ACCESS_KEY,
      region: e.S3_REGION || 'auto',
      service: 's3',
    }),
    objectUrl: (key: string) => `${e.S3_ENDPOINT.replace(/\/$/, '')}/${e.S3_BUCKET}/${key}`,
  };
}

const s3Driver: StorageDriver = {
  async put(key, body, contentType) {
    if (!isValidStorageKey(key)) throw new AppError(400, 'BAD_KEY', 'Invalid storage key');
    const { client, objectUrl } = s3Client();
    const res = await client.fetch(objectUrl(key), {
      method: 'PUT',
      body: body as unknown as BodyInit,
      headers: { 'content-type': contentType, 'cache-control': 'public, max-age=31536000, immutable' },
    });
    if (!res.ok) throw new AppError(502, 'STORAGE_WRITE_FAILED', 'Image could not be stored');
    const head = await client.fetch(objectUrl(key), { method: 'HEAD' });
    if (!head.ok || Number(head.headers.get('content-length')) !== body.byteLength) {
      throw new AppError(502, 'STORAGE_WRITE_FAILED', 'Image upload could not be confirmed');
    }
    return { key, url: this.publicUrl(key) };
  },
  async delete(key) {
    if (!isValidStorageKey(key)) return;
    const { client, objectUrl } = s3Client();
    await client.fetch(objectUrl(key), { method: 'DELETE' });
  },
  publicUrl: (key) => `${publicBase()}/${key}`,
};

export const storage = (): StorageDriver => (env().STORAGE_DRIVER === 's3' ? s3Driver : localDriver);

/** Read a locally stored object (dev media route). */
export async function readLocalObject(key: string) {
  return readFile(resolveLocalPath(key));
}
