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
    <div role="dialog" aria-modal="false" aria-labelledby="consent-title" className="fixed inset-x-3 bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.5rem)] z-50 animate-pop-in md:inset-x-auto md:bottom-4 md:right-4 md:w-[380px]">
      <div className="max-h-[calc(100dvh-10rem)] overflow-y-auto rounded-2xl border border-line bg-surface p-4 shadow-pop">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-cream text-brand-orange">
            <BarChart3 className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p id="consent-title" className="text-sm font-semibold text-ink">Help us stock what you need</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-600">
              With your permission we record which products and categories you view and what you search for on 20Mart, so we can stock
              the right items. We never sell this data. Essential cookies for sign-in, your cart and delivery location are always on.{' '}
              <Link href="/privacy#analytics" className="font-semibold text-brand-orange-600 underline">
                Learn more
              </Link>
            </p>
            {manual && current && (
              <p className="mt-1.5 text-2xs font-semibold text-ink-500">Current choice: {current === 'granted' ? 'analytics allowed' : 'essential only'}</p>
            )}
            {optOut && <p className="mt-1.5 text-2xs font-semibold text-ink-500">Your browser asks sites not to track you, so analytics stays off.</p>}
            {error && (
              <p role="alert" className="mt-1.5 text-2xs font-semibold text-danger">
                {error}
              </p>
            )}
          </div>
          {manual && (
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="-mr-1 -mt-1 rounded-md p-1 text-ink-400 hover:bg-surface-muted hover:text-ink-700">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => choose(false)}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-line-strong bg-surface px-3 text-sm font-semibold text-ink-700 hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-400/40 disabled:opacity-50"
          >
            Essential only
          </button>
          <button
            type="button"
            disabled={busy || optOut}
            onClick={() => choose(true)}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-brand-orange px-3 text-sm font-semibold text-white hover:bg-brand-orange-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40 focus-visible:ring-offset-1 disabled:opacity-50"
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
