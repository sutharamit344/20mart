import { formatPaise } from '@20mart/shared';
import { env } from '../env';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const absoluteUrl = (path: string) => {
  try {
    return new URL(path, env().APP_URL).toString();
  } catch {
    return path;
  }
};

export interface EmailContent {
  heading: string;
  paragraphs: string[];
  /** Optional table rows (label, value) — e.g. order summary. */
  rows?: [string, string][];
  cta?: { label: string; href: string };
  footnote?: string;
}

/** Minimal, inline-styled, table-free layout that renders in all major clients. All text is escaped. */
export function renderEmail(c: EmailContent) {
  const rows = c.rows?.length
    ? `<table role="presentation" style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">${c.rows
        .map(([k, v]) => `<tr><td style="padding:6px 0;color:#555">${esc(k)}</td><td style="padding:6px 0;text-align:right;color:#111;font-weight:600">${esc(v)}</td></tr>`)
        .join('')}</table>`
    : '';
  const cta = c.cta
    ? `<p style="margin:24px 0"><a href="${esc(absoluteUrl(c.cta.href))}" style="background:#0B5D3B;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;display:inline-block">${esc(c.cta.label)}</a></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#f5f5f4;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<div style="background:#fff;border-radius:12px;padding:24px">
<p style="margin:0 0 16px;font-size:20px;font-weight:800;color:#0B5D3B">20Mart</p>
<h1 style="margin:0 0 12px;font-size:20px;color:#111">${esc(c.heading)}</h1>
${c.paragraphs.map((p) => `<p style="margin:0 0 12px;font-size:14px;line-height:1.5;color:#333">${esc(p)}</p>`).join('')}
${rows}${cta}
</div>
<p style="margin:16px 0 0;font-size:11px;color:#888;text-align:center">${esc(c.footnote ?? 'You are receiving this because you have a 20Mart account. Manage email preferences in your account settings.')}</p>
</div></body></html>`;
}

export const money = formatPaise;
