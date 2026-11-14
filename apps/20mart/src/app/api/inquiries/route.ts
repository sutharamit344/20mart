import { NextResponse } from 'next/server';
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

export async function GET() {
  const list = getInquiries();
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, phone, subject, message } = body;

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Name, email, and message are required' }, { status: 400 });
    }

    const currentList = getInquiries();
    const newInquiry: ContactInquiry = {
      id: `inq-${Date.now()}`,
      ticketNumber: `INQ-${Math.floor(1000 + Math.random() * 9000)}`,
      name: String(name).trim(),
      email: String(email).trim(),
      phone: phone ? String(phone).trim() : undefined,
      subject: subject || 'Order & Delivery Inquiry',
      message: String(message).trim(),
      createdAt: 'Just now',
      status: 'NEW',
      priority:
        String(subject).toLowerCase().includes('damage') ||
        String(subject).toLowerCase().includes('bulk')
          ? 'HIGH'
          : 'NORMAL',
    };

    const updatedList = [newInquiry, ...currentList];
    saveInquiries(updatedList);

    return NextResponse.json({ success: true, inquiry: newInquiry }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

