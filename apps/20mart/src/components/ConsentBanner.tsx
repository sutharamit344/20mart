'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart3, X } from 'lucide-react';
import { browserOptsOut, CONSENT_EVENT, saveConsent, storedConsent } from '../lib/analytics';

/**
 * Asks for OPTIONAL analytics consent. Nothing optional is collected until the shopper chooses
 * "Allow analytics". Essential cookies (sign-in, cart, delivery location) are not affected by the choice.
 * Reopened from the footer's "Privacy choices" link.
 */
export function ConsentBanner() {
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<'granted' | 'denied' | null>(null);
  const optOut = typeof navigator !== 'undefined' && browserOptsOut();

  useEffect(() => {
    const stored = storedConsent();
    setCurrent(stored);
    // GPC/DNT already says "no": respect it without asking.
    if (!stored && !browserOptsOut()) setOpen(true);
    const reopen = () => {
      setCurrent(storedConsent());
      setManual(true);
      setOpen(true);
    };
    window.addEventListener(CONSENT_EVENT, reopen);
    return () => window.removeEventListener(CONSENT_EVENT, reopen);
  }, []);

  if (!open) return null;

  const choose = async (allow: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await saveConsent(allow);
      setCurrent(allow ? 'granted' : 'denied');
      setOpen(false);
    } catch {
      setError('Could not save your choice. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="dialog" aria-modal="false" aria-labelledby="consent-title" className="fixed inset-x-3 bottom-[4.5rem] z-50 md:inset-x-auto md:bottom-4 md:right-4 md:w-[380px]">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FFF6E9] text-[#FF7A00]">
            <BarChart3 className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p id="consent-title" className="text-sm font-bold text-gray-900">Help us stock what you need</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-600">
              With your permission we record which products and categories you view and what you search for on 20Mart, so we can stock
              the right items. We never sell this data. Essential cookies for sign-in, your cart and delivery location are always on.{' '}
              <Link href="/privacy#analytics" className="font-semibold text-[#E66E00] underline">
                Learn more
              </Link>
            </p>
            {manual && current && (
              <p className="mt-1.5 text-[11px] font-semibold text-gray-500">Current choice: {current === 'granted' ? 'analytics allowed' : 'essential only'}</p>
            )}
            {optOut && <p className="mt-1.5 text-[11px] font-semibold text-gray-500">Your browser asks sites not to track you, so analytics stays off.</p>}
            {error && (
              <p role="alert" className="mt-1.5 text-[11px] font-semibold text-red-600">
                {error}
              </p>
            )}
          </div>
          {manual && (
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="-mr-1 -mt-1 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => choose(false)}
            className="inline-flex h-9 items-center justify-center rounded-xl border border-gray-300 bg-white px-3 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Essential only
          </button>
          <button
            type="button"
            disabled={busy || optOut}
            onClick={() => choose(true)}
            className="inline-flex h-9 items-center justify-center rounded-xl bg-[#FF7A00] px-3 text-xs font-bold text-white hover:bg-[#E66E00] disabled:opacity-50"
          >
            Allow analytics
          </button>
        </div>
      </div>
    </div>
  );
}

/** Footer link that reopens the consent choice. */
export function PrivacyChoicesLink({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(CONSENT_EVENT))}>
      Privacy choices
    </button>
  );
}
