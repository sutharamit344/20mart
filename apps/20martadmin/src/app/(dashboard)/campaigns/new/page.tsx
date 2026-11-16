import { prisma } from '@20mart/database';
import { requireAdminPage } from '@20mart/server/next';
import { AccessDenied, PageHeader, Panel } from '../../../../components/ui';
import { CampaignForm, EMPTY_CAMPAIGN } from '../CampaignForm';

export default async function NewCampaignPage() {
  const ctx = await requireAdminPage();
  if (!ctx.permissions.has('campaigns.create')) return <AccessDenied permission="campaigns.create" />;
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' }, take: 200, select: { id: true, code: true, title: true, isActive: true } });
  return (
    <div className="space-y-3 sm:space-y-4 max-w-3xl">
      <PageHeader title="New campaign" description="Campaigns start inactive unless you tick Active." />
      <Panel bodyClassName="p-4">
        <CampaignForm initial={EMPTY_CAMPAIGN} coupons={coupons} canEdit canUpload={false} hasParticipants={false} />
      </Panel>
    </div>
  );
}
