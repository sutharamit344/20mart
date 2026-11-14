import { adminRoute } from '@20mart/server/next';
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

// Inquiries hold customer PII: readable only by authenticated admins with settings.view.
// (Customers submit inquiries through the storefront's POST /api/inquiries.)
export const GET = adminRoute('settings.view', async () => getInquiries());
