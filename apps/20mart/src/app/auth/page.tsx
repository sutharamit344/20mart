import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { AuthPanel } from '../../components/AuthPanel';

export const metadata: Metadata = {
  title: 'Sign in – 20Mart',
  robots: { index: false },
};

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-gray-400">Loading sign in…</div>}>
      <AuthPanel />
    </Suspense>
  );
}
