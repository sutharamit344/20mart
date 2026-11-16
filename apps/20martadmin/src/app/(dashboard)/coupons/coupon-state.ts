/** Admin display state of a coupon. */
export function couponState(c: { isActive: boolean; startsAt: Date; endsAt: Date | null; usageLimit: number | null; usedCount: number }) {
  const now = new Date();
  if (!c.isActive) return { status: 'INACTIVE', label: 'Inactive' };
  if (c.endsAt && c.endsAt <= now) return { status: 'ARCHIVED', label: 'Expired' };
  if (c.startsAt > now) return { status: 'LOW', label: 'Scheduled' };
  if (c.usageLimit != null && c.usedCount >= c.usageLimit) return { status: 'OUT', label: 'Used up' };
  return { status: 'ACTIVE', label: 'Live' };
}
