'use client';

/**
 * Minimal, dependency-free spreadsheet reader for the bulk product import.
 * Reads the FIRST worksheet of an .xlsx file (a zip of XML parts, unzipped with the browser's
 * DecompressionStream) or a .csv file, and returns rows as objects keyed by the header row.
 * Everything runs in the browser; nothing is uploaded until the import itself.
 */

export type SheetRow = Record<string, string>;

/* ───────────────────────────── zip ───────────────────────────── */

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unzip(buf: ArrayBuffer, wanted: (name: string) => boolean): Promise<Map<string, string>> {
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  // End of central directory: last occurrence of 0x06054b50 (within the 64 KB comment window).
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('This is not a valid .xlsx file');
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out = new Map<string, string>();
  for (let n = 0; n < count; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) throw new Error('Damaged .xlsx file');
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (!wanted(name)) continue;
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const raw = bytes.subarray(start, start + size);
    if (method !== 0 && method !== 8) throw new Error('Unsupported .xlsx compression');
    out.set(name, dec.decode(method === 8 ? await inflateRaw(raw) : raw));
  }
  return out;
}

/* ───────────────────────────── xlsx ───────────────────────────── */

const xml = (s: string) => new DOMParser().parseFromString(s, 'application/xml');
const byTag = (el: Document | Element, tag: string) => Array.from(el.getElementsByTagNameNS('*', tag));

function colIndex(ref: string) {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? 'A';
  return [...letters].reduce((a, c) => a * 26 + (c.charCodeAt(0) - 64), 0) - 1;
}

async function readXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const parts = await unzip(buf, (n) => n === 'xl/workbook.xml' || n === 'xl/_rels/workbook.xml.rels' || n === 'xl/sharedStrings.xml' || n.startsWith('xl/worksheets/'));
  const wb = parts.get('xl/workbook.xml');
  const rels = parts.get('xl/_rels/workbook.xml.rels');
  if (!wb || !rels) throw new Error('This is not a valid .xlsx file');
  const first = byTag(xml(wb), 'sheet')[0];
  const rid = first?.getAttribute('r:id') ?? first?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
  const target = byTag(xml(rels), 'Relationship').find((r) => r.getAttribute('Id') === rid)?.getAttribute('Target');
  if (!target) throw new Error('The workbook has no worksheet');
  const sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
  const sheet = parts.get(sheetPath);
  if (!sheet) throw new Error('The first worksheet could not be read');
  const shared = parts.get('xl/sharedStrings.xml');
  const strings = shared ? byTag(xml(shared), 'si').map((si) => byTag(si, 't').map((t) => t.textContent ?? '').join('')) : [];

  const rows: string[][] = [];
  for (const row of byTag(xml(sheet), 'row')) {
    const cells: string[] = [];
    for (const c of byTag(row, 'c')) {
      const type = c.getAttribute('t');
      const v = byTag(c, 'v')[0]?.textContent ?? '';
      let value = v;
      if (type === 's') value = strings[Number(v)] ?? '';
      else if (type === 'inlineStr') value = byTag(c, 't').map((t) => t.textContent ?? '').join('');
      else if (type === 'b') value = v === '1' ? 'TRUE' : 'FALSE';
      cells[colIndex(c.getAttribute('r') ?? '')] = value;
    }
    rows.push(Array.from(cells, (x) => (x ?? '').trim()));
  }
  return rows;
}

/* ───────────────────────────── csv ───────────────────────────── */

function readCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const t = text.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (quoted) {
      if (ch === '"' && t[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows;
}

/** Normalised header key: lower-case, no bracketed notes, single spaces ("MRP INR" → "mrp inr"). */
export const headerKey = (h: string) =>
  h
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Read a spreadsheet file into header-keyed rows (blank rows dropped). */
export async function readSheet(file: File): Promise<{ headers: string[]; rows: SheetRow[] }> {
  const name = file.name.toLowerCase();
  let grid: string[][];
  if (name.endsWith('.xlsx')) grid = await readXlsx(await file.arrayBuffer());
  else if (name.endsWith('.csv')) grid = readCsv(await file.text());
  else throw new Error('Use an .xlsx or .csv file');
  const [head = [], ...body] = grid;
  const headers = head.map(headerKey);
  const rows = body
    .filter((r) => r.some((c) => c))
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()]).filter(([h]) => h)));
  return { headers, rows };
}
