'use client';

import { useEffect, useRef } from 'react';
import type { ClientEventName } from '@20mart/shared';
import { analyticsAllowed, CONSENT_CHANGED_EVENT, track, type TrackProps } from '../lib/analytics';

const lastOnce = new Map<string, string>();

/**
 * Sends one browsing event when a (statically rendered) page is shown in the browser. Pages are ISR,
 * so views can only be counted here. A no-op without analytics consent (see lib/analytics).
 * It fires again only when the event or its subject changes (e.g. client navigation to another product).
 * `once` narrows "its subject" (e.g. a search term, so filtering or paging its results is not a new search).
 */
export function TrackView({ name, once, ...props }: { name: ClientEventName; once?: string } & TrackProps) {
  const key = JSON.stringify([name, once ?? props]);
  const sent = useRef<string | null>(null);
  useEffect(() => {
    if (sent.current === key) return; // React strict mode / re-render
    sent.current = key;
    if (once !== undefined) {
      // Route loading states remount the listing on every filter/page change, so the last `once`
      // subject per event is kept for the tab's lifetime (a full reload starts afresh).
      if (lastOnce.get(name) === key) return;
      lastOnce.set(name, key);
    }
    track(name, props);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures name and props
  }, [key]);
  return null;
}

const OPENED_KEY = '20m_app_opened';

/** APP_OPENED once per browser tab session — also right after the shopper allows analytics. */
export function AppOpened() {
  useEffect(() => {
    const send = () => {
      if (!analyticsAllowed()) return;
      try {
        if (sessionStorage.getItem(OPENED_KEY)) return;
        sessionStorage.setItem(OPENED_KEY, '1');
      } catch {
        // Storage unavailable (private mode): fall back to once per page load.
        if ((window as Window & { __20mOpened?: boolean }).__20mOpened) return;
        (window as Window & { __20mOpened?: boolean }).__20mOpened = true;
      }
      track('APP_OPENED');
    };
    send();
    window.addEventListener(CONSENT_CHANGED_EVENT, send);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, send);
  }, []);
  return null;
}
