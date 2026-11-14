import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { rateLimit } from '@20mart/server/rateLimit';
import fs from 'fs';
import path from 'path';
import { mockContactInquiries, ContactInquiry } from '@20mart/shared';

// Shared persistence file across dev servers
const dbFilePath = path.resolve(process.cwd(), '..', '..', 'packages', 'shared', 'src', 'inquiries-db.json');

function getInquiries(): ContactInquiry[] {
  try {
    if (fs.existsSync(dbFilePath)) {
      const data = fs.readFileSync(dbFilePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error reading inquiries-db.json:', e);
  }
  return mockContactInquiries;
}

function saveInquiries(inquiries: ContactInquiry[]) {
  try {
    const dir = path.dirname(dbFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(dbFilePath, JSON.stringify(inquiries, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing inquiries-db.json:', e);
  }
}

// NOTE: there is intentionally no GET handler here. Inquiries contain customer
// PII and are only readable through the authenticated admin app.

const inquirySchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
  subject: z.string().trim().max(120).optional(),
  message: z.string().trim().min(5).max(2000),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.ip || 'unknown';
  if (!rateLimit(`inquiry:${ip}`, 5, 10 * 60 * 1000).ok) {
    return NextResponse.json({ error: 'Too many messages. Please try again later.' }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const parsed = inquirySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Name, a valid email, and a message are required' }, { status: 400 });
  }
  const { name, email, phone, subject, message } = parsed.data;
  const newInquiry: ContactInquiry = {
    id: `inq-${randomUUID()}`,
    ticketNumber: `INQ-${Math.floor(1000 + Math.random() * 9000)}`,
    name,
    email,
    phone: phone || undefined,
    subject: subject || 'Order & Delivery Inquiry',
    message,
    createdAt: 'Just now',
    status: 'NEW',
    priority: /damage|bulk/i.test(subject ?? '') ? 'HIGH' : 'NORMAL',
  };
  saveInquiries([newInquiry, ...getInquiries()]);
  // Only echo back the non-sensitive ticket reference.
  return NextResponse.json({ success: true, inquiry: { ticketNumber: newInquiry.ticketNumber } }, { status: 201 });
}
