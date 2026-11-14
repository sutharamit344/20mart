'use client';

import React, { useRef, useState } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import { api, errMsg } from '../lib/api';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif';
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Client-side pre-checks (the server re-validates bytes, type and dimensions). */
export function precheckImage(file: File): string | null {
  if (!ACCEPT.split(',').includes(file.type)) return 'Use a JPEG, PNG, WebP or AVIF image';
  if (file.size > MAX_UPLOAD_BYTES) return 'Image must be 5 MB or smaller';
  return null;
}

/** Single-image uploader that POSTs to `endpoint` and reports the stored URL only after the server confirms. */
export function ImageUploadField({
  endpoint,
  currentUrl,
  label,
  onUploaded,
  disabled,
}: {
  endpoint: string;
  currentUrl: string | null;
  label: string;
  onUploaded: (url: string) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl);

  const upload = async (file: File) => {
    const pre = precheckImage(file);
    if (pre) return setError(pre);
    setError(null);
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api<Record<string, string>>(endpoint, { form });
      const url = res.imageUrl ?? res.logoUrl;
      setPreview(url);
      onUploaded(url);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div>
      <p className="block text-[11px] font-semibold text-gray-700 mb-1">{label}</p>
      <div className="flex items-center gap-3">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-gray-300">
              <ImagePlus className="w-5 h-5" />
            </div>
          )}
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70">
              <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <button
            type="button"
            disabled={busy || disabled}
            onClick={() => input.current?.click()}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <ImagePlus className="w-3.5 h-3.5" /> {preview ? 'Replace' : 'Upload'}
          </button>
          <p className="mt-1 text-[10px] text-gray-400">JPEG/PNG/WebP/AVIF · max 5 MB · min 100×100</p>
          {error && <p className="mt-1 text-[11px] font-medium text-red-600">{error}</p>}
        </div>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
      </div>
    </div>
  );
}
