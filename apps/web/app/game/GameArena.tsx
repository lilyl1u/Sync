'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { preloadGameAssets } from '@/app/game/utils/gamePreload';

const GeometryDashGame = dynamic(
  () => import('./components/GeometryDashGame').then((mod) => mod.GeometryDashGame),
  {
    ssr: false,
    loading: () => <p className="px-kicker px-blink">Loading arena...</p>,
  },
);

type GameArenaProps = {
  duelCode?: string;
  role?: 'host' | 'joiner';
};

export function GameArena({ duelCode, role }: GameArenaProps) {
  useEffect(() => {
    void preloadGameAssets();
  }, []);

  return (
    <GeometryDashGame
      width={1200}
      height={600}
      duelCode={duelCode}
      role={role}
    />
  );
}
