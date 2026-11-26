import Link from 'next/link';

export default function AdminNotFound() {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-line bg-surface p-6 text-center ">
      <p className="text-sm font-bold text-ink">Not found</p>
      <p className="mt-1 text-xs text-ink-500">That record doesn&apos;t exist or was deleted.</p>
      <Link href="/" className="mt-4 inline-flex h-8 items-center rounded-lg bg-brand-green px-3 text-xs font-semibold text-white">
        Back to dashboard
      </Link>
    </div>
  );
}
