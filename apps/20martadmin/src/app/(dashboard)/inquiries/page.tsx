import { inquiryListQuery, listInquiries } from '@20mart/server';
import { requireAdminPage } from '@20mart/server/next';
import { AccessDenied, PageHeader, Pagination, Panel } from '../../../components/ui';
import { FilterBar } from '../../../components/FilterBar';
import { InquiriesTable } from './InquiriesTable';

export default async function InquiriesPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const ctx = await requireAdminPage();
  if (!ctx.permissions.has('inquiries.view')) return <AccessDenied permission="inquiries.view" />;
  const parsed = inquiryListQuery.safeParse(searchParams);
  const data = await listInquiries(parsed.success ? parsed.data : {});
  return (
    <div className="space-y-3 sm:space-y-4">
      <PageHeader title="Customer inquiries" description={`Messages from the storefront contact form · ${data.newCount} new`} />
      <FilterBar
        placeholder="Ticket, name, email or subject…"
        selects={[
          { name: 'status', label: 'Any status', options: ['NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase().replace('_', ' ') })) },
          { name: 'priority', label: 'Any priority', options: ['HIGH', 'NORMAL', 'LOW'].map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() })) },
        ]}
      />
      <Panel>
        <InquiriesTable
          items={data.items.map((i) => ({ ...i, createdAt: i.createdAt.toISOString(), updatedAt: i.updatedAt.toISOString() }))}
          canManage={ctx.permissions.has('inquiries.manage')}
        />
        <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/inquiries" params={searchParams} />
      </Panel>
    </div>
  );
}
