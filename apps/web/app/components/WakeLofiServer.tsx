'use client';

import { useEffect } from 'react';
import { preloadGameAssets } from '@/app/game/utils/gamePreload';

/**
 * Start fetching game music as soon as the landing page mounts so /game
 * does not wait on a Modal cold start.
 */
export function WakeLofiServer() {
  useEffect(() => {
    void preloadGameAssets();
  }, []);
  return null;
}
