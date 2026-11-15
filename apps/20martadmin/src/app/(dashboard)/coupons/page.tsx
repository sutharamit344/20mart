import { redirect } from 'next/navigation';

// Hidden until this module is backed by the database (no dummy data is shown).
export default function HiddenModule() {
  redirect('/');
}
