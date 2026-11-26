import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Logo } from '@20mart/ui';
import { getCurrentAdmin } from '@20mart/server/next';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Sign in – 20Mart Admin' };
export const dynamic = 'force-dynamic';

const safeNext = (v?: string) => (v && v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/api') ? v : '/');

export default async function AdminLoginPage(props: { searchParams: Promise<{ next?: string }> }) {
  const searchParams = await props.searchParams;
  const next = safeNext(searchParams.next);
  if (await getCurrentAdmin()) redirect(next);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-green-900 via-brand-green to-[#042819] p-4">
      <div className="w-full max-w-sm rounded-2xl bg-surface p-6 sm:p-7 shadow-2xl space-y-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <Logo size="md" />
          <span className="rounded-md bg-brand-orange px-2 py-0.5 text-2xs font-bold uppercase tracking-wider text-white">
            Admin Console
          </span>
          <h1 className="text-lg font-extrabold text-ink">Sign in to continue</h1>
          <p className="text-xs text-ink-500">Authorised 20Mart staff only. All activity is audited.</p>
        </div>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
