import { redirect } from 'next/navigation';

export default function OtpPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const qs = new URLSearchParams(Object.entries(searchParams).filter((e): e is [string, string] => !!e[1])).toString();
  redirect(qs ? `/auth?${qs}` : '/auth');
}
