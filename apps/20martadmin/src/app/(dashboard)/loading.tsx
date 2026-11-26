export default function DashboardLoading() {
  return (
    <div className="space-y-3 animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="h-6 w-48 rounded bg-line" />
      <div className="h-12 rounded-xl bg-surface-muted" />
      <div className="h-64 rounded-xl bg-surface-muted" />
    </div>
  );
}
