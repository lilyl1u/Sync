'use client';

import { useEffect } from 'react';

const WARM_KEY = 'lofi-server-warmed';

/**
 * Fires a single POST to the lofi API when the user hits the landing page.
 * This warms the Modal serverless backend so the game's music load is fast.
 * Runs at most once per browser session to avoid extra cost on refresh.
 */
export function WakeLofiServer() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (sessionStorage.getItem(WARM_KEY)) return;
      sessionStorage.setItem(WARM_KEY, '1');
      fetch('/api/generate-lofi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ length: 200, temperature: 0.8 }),
      }).catch(() => {});
    } catch {
      // ignore
    }
  }, []);
  return null;
}
