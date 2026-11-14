import { listAuditLogs } from '@20mart/server';
import { requireAdminPage } from '@20mart/server/next';
import { AccessDenied, PageHeader, Pagination, Panel, StatusBadge, Table, TableEmpty, TBody, Td, Th, THead } from '../../../components/ui';
import { FilterBar } from '../../../components/FilterBar';

const CATEGORIES = ['AUTH', 'PRODUCT', 'CATEGORY', 'BRAND', 'INVENTORY', 'MEDIA', 'USER_MANAGEMENT', 'ROLE'];

export default async function AuditPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const ctx = await requireAdminPage();
  if (!ctx.permissions.has('audit.view')) return <AccessDenied permission="audit.view" />;
  const page = Math.max(1, Math.min(10_000, Number(searchParams.page) || 1));
  const category = CATEGORIES.includes(searchParams.category ?? '') ? searchParams.category : undefined;
  const data = await listAuditLogs({ page, pageSize: 30, category });

  return (
    <div className="space-y-3 sm:space-y-4">
      <PageHeader title="Audit log" description="Immutable trail of administrative actions." />
      <FilterBar
        search={false}
        selects={[{ name: 'category', label: 'All areas', options: CATEGORIES.map((c) => ({ value: c, label: c.replace('_', ' ').toLowerCase() })) }]}
      />
      <Panel>
        <Table minWidth={720}>
          <THead>
            <Th>When</Th>
            <Th>Admin</Th>
            <Th>Area</Th>
            <Th>Action</Th>
            <Th>Details</Th>
          </THead>
          <TBody>
            {data.items.length === 0 && <TableEmpty colSpan={5} title="No audit entries yet" />}
            {data.items.map((l) => (
              <tr key={l.id}>
                <Td className="whitespace-nowrap text-gray-500">{l.createdAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</Td>
                <Td className="whitespace-nowrap font-semibold text-gray-800">{l.adminName}</Td>
                <Td>
                  <StatusBadge status={l.category} label={l.category.replace('_', ' ').toLowerCase()} />
                </Td>
                <Td className="whitespace-nowrap">{l.action}</Td>
                <Td className="max-w-[28rem] text-gray-500">
                  <span className="line-clamp-2 break-words">{l.details}</span>
                </Td>
              </tr>
            ))}
          </TBody>
        </Table>
        <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/audit" params={{ category }} />
      </Panel>
    </div>
  );
}
