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

/** 20Mart brand palette (mirrors apps/20mart/src/app/globals.css). */
const C = {
  green: '#0B5D3B',
  orange: '#FF7A00',
  cream: '#FFF6E9',
  page: '#F8F9FA',
  ink: '#1F2937',
  body: '#4B5563',
  muted: '#9CA3AF',
  line: '#EEF0F2',
} as const;

const FONT = "'Poppins','Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const logoUrl = () => env().EMAIL_LOGO_URL || absoluteUrl('/email/20mart-logo.png');

export interface EmailContent {
  heading: string;
  paragraphs: string[];
  /** Optional table rows (label, value) — e.g. order summary. A row labelled "Total" is emphasised. */
  rows?: [string, string][];
  cta?: { label: string; href: string };
  footnote?: string;
}

/** Branded, inline-styled, table-based layout that renders in all major clients (incl. Outlook). All text is escaped. */
export function renderEmail(c: EmailContent) {
  const preheader = c.paragraphs[0] ?? c.heading;

  const rows = c.rows?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:separate;background:${C.cream};border-radius:12px;margin:20px 0 4px">
<tr><td style="padding:8px 20px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;font-family:${FONT};font-size:14px">${c.rows
        .map(([k, v]) => {
          const total = /^total$/i.test(k.trim());
          const cell = total ? `padding:12px 0 8px;border-top:1px dashed #E8D9C2;` : 'padding:8px 0;';
          return `<tr><td style="${cell}color:${total ? C.ink : C.body};font-weight:${total ? 700 : 400}">${esc(k)}</td><td align="right" style="${cell}text-align:right;color:${total ? C.green : C.ink};font-weight:700;font-size:${total ? 16 : 14}px">${esc(v)}</td></tr>`;
        })
        .join('')}</table>
</td></tr></table>`
    : '';

  const cta = c.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 4px"><tr><td align="center" bgcolor="${C.orange}" style="border-radius:999px;background:${C.orange}">
<a href="${esc(absoluteUrl(c.cta.href))}" style="display:inline-block;padding:14px 32px;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px">${esc(c.cta.label)}</a>
</td></tr></table>`
    : '';

  const shop = esc(absoluteUrl('/'));

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>${esc(c.heading)}</title></head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid ${C.line};border-radius:16px;overflow:hidden">
<tr><td height="5" style="height:5px;line-height:5px;font-size:0;background:${C.green}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="70%" height="5" style="background:${C.green};font-size:0;line-height:5px">&nbsp;</td><td width="30%" height="5" style="background:${C.orange};font-size:0;line-height:5px">&nbsp;</td></tr></table></td></tr>
<tr><td align="center" style="padding:24px 24px 8px"><a href="${shop}" style="text-decoration:none"><img src="${esc(logoUrl())}" width="160" height="74" alt="20Mart" style="display:block;border:0;width:160px;height:auto;font-family:${FONT};font-size:22px;font-weight:800;color:${C.green}"></a></td></tr>
<tr><td style="padding:12px 32px 32px;font-family:${FONT}">
<h1 style="margin:0 0 12px;font-family:${FONT};font-size:22px;line-height:1.3;font-weight:700;color:${C.ink};text-align:center">${esc(c.heading)}</h1>
${c.paragraphs.map((p) => `<p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:${C.body};text-align:center">${esc(p)}</p>`).join('')}
${rows}${cta}
</td></tr>
<tr><td style="background:${C.cream};padding:16px 24px;text-align:center;font-family:${FONT}">
<p style="margin:0;font-size:13px;font-weight:700;color:${C.green}">20Mart <span style="color:${C.orange}">·</span> <span style="font-weight:400;color:${C.body}">Your Everyday Value Market</span></p>
<p style="margin:6px 0 0;font-size:12px"><a href="${shop}" style="color:${C.green};text-decoration:underline">Shop now</a> <span style="color:${C.muted}">&nbsp;|&nbsp;</span> <a href="${esc(absoluteUrl('/account/orders'))}" style="color:${C.green};text-decoration:underline">My orders</a></p>
</td></tr>
</table>
<p style="max-width:520px;margin:16px auto 0;font-family:${FONT};font-size:11px;line-height:1.5;color:${C.muted};text-align:center">${esc(c.footnote ?? 'You are receiving this because you have a 20Mart account. Manage email preferences in your account settings.')}</p>
</td></tr></table>
</body></html>`;
}

export const money = formatPaise;
