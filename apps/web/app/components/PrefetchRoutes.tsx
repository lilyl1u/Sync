'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { preloadGameAssets } from '@/app/game/utils/gamePreload';

const ROUTES = ['/game', '/duels'] as const;

/** Warm Next.js route caches and the music API so Play / Duels open quickly. */
export function PrefetchRoutes() {
  const router = useRouter();

  useEffect(() => {
    for (const route of ROUTES) {
      router.prefetch(route);
    }
    void preloadGameAssets();
  }, [router]);

  return null;
}
