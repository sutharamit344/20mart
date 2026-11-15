import { redirect } from 'next/navigation';

// Hidden until a real (database-backed) offers programme exists; no dummy offers are shown.
export default function HiddenPage() {
  redirect('/');
}
