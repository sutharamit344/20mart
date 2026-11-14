'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Logo } from '@20mart/ui';
import { Loader2, ShieldCheck, Sparkles, Truck, AlertCircle } from 'lucide-react';
import { useStore } from '../lib/store';

const ERROR_MESSAGES: Record<string, string> = {
  cancelled: 'Google sign-in was cancelled. Please try again.',
  expired: 'Your sign-in session expired. Please try again.',
  email_unverified: 'Your Google email address is not verified. Verify it with Google and try again.',
  suspended: 'This account has been suspended. Please contact support.',
  link_required:
    'An account with this email already exists. Please sign in with your original method to link Google.',
  google_not_configured: 'Google sign-in is not available right now. Please try again later.',
  rate_limited: 'Too many attempts. Please wait a minute and try again.',
  failed: 'We could not sign you in with Google. Please try again.',
  server_error: 'Something went wrong. Please try again.',
};

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5 shrink-0" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function AuthPanel() {
  const router = useRouter();
  const params = useSearchParams();
  const { authStatus } = useStore();
  const [redirecting, setRedirecting] = useState(false);

  const errorCode = params.get('error');
  const error = errorCode ? ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.failed : null;
  const returnTo = params.get('returnTo') ?? '/account';

  // Already signed in → go straight to the destination.
  useEffect(() => {
    if (authStatus === 'authenticated') router.replace(returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/account');
  }, [authStatus, returnTo, router]);

  const startGoogle = () => {
    setRedirecting(true);
    window.location.assign(`/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-14 flex items-center justify-center">
      <div className="w-full max-w-md rounded-3xl border border-gray-100 bg-white p-6 sm:p-8 shadow-md space-y-5">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <Logo size="lg" showTagline={true} />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900">Welcome to 20Mart</h1>
          <p className="text-xs text-gray-500">Sign in or create your account in one tap with Google.</p>
        </div>

        <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-orange-50/60 border border-orange-100 text-[11px] text-gray-700">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#FF7A00] shrink-0" />
            <span>Everyday essentials from ₹20</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5 text-[#0B5D3B] shrink-0" />
            <span>Fast doorstep delivery</span>
          </div>
        </div>

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          onClick={startGoogle}
          disabled={redirecting || authStatus === 'authenticated'}
          className="flex w-full h-12 items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white px-4 text-sm font-bold text-gray-800 shadow-xs transition-all hover:bg-gray-50 hover:border-gray-400 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]/40 disabled:opacity-70 disabled:cursor-wait"
        >
          {redirecting ? <Loader2 className="h-5 w-5 animate-spin text-gray-500" /> : <GoogleMark />}
          <span>{redirecting ? 'Redirecting to Google…' : 'Continue with Google'}</span>
        </button>

        <div className="flex items-start gap-2 rounded-xl bg-gray-50 p-3 text-[11px] text-gray-500">
          <ShieldCheck className="w-4 h-4 shrink-0 text-[#0B5D3B]" />
          <p>
            We only use your verified Google name, email and photo to create your account. We never see your Google
            password.
          </p>
        </div>

        <p className="text-center text-[11px] text-gray-400">
          By continuing you agree to our{' '}
          <a href="/terms" className="font-semibold text-gray-600 hover:text-[#FF7A00]">
            Terms
          </a>{' '}
          and{' '}
          <a href="/privacy" className="font-semibold text-gray-600 hover:text-[#FF7A00]">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  );
}
