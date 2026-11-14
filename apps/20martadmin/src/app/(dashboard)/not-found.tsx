import Link from 'next/link';

export default function AdminNotFound() {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-6 text-center shadow-2xs">
      <p className="text-sm font-bold text-gray-900">Not found</p>
      <p className="mt-1 text-xs text-gray-500">That record doesn&apos;t exist or was deleted.</p>
      <Link href="/" className="mt-4 inline-flex h-8 items-center rounded-lg bg-[#0B5D3B] px-3 text-xs font-semibold text-white">
        Back to dashboard
      </Link>
    </div>
  );
}
