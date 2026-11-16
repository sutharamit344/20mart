/**
 * Child-row counts for a page of parent rows.
 *
 * Prisma's relation `_count` select compiles to
 *   LEFT JOIN (SELECT fk, COUNT(*) FROM child GROUP BY fk) …
 * with no filter, i.e. it aggregates the ENTIRE child table on every request. On growing
 * tables (OrderItem, Order, StockMovement, Payment…) use a filtered groupBy over the ids of
 * the current page instead:
 *
 *   const n = await countBy(prisma.orderItem.groupBy({ by: ['orderId'], where: { orderId: { in: ids } }, _count: { _all: true } }), (g) => g.orderId);
 */
export async function countBy<T extends { _count: { _all: number } }>(rows: Promise<T[]> | T[], key: (row: T) => string): Promise<Map<string, number>> {
  return new Map((await rows).map((r) => [key(r), r._count._all]));
}
