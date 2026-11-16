import { redirect } from 'next/navigation';

export default async function RegisterPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const searchParams = await props.searchParams;
  const qs = new URLSearchParams(Object.entries(searchParams).filter((e): e is [string, string] => !!e[1])).toString();
  redirect(qs ? `/auth?${qs}` : '/auth');
}
