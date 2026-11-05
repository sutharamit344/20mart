'use client';

import React, { Suspense } from 'react';
import AuthPage from '../page';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-gray-400">Loading sign in...</div>}>
      <AuthPage />
    </Suspense>
  );
}

