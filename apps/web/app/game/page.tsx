import Link from 'next/link';
import { GameArena } from './GameArena';

export default async function GamePage({
  searchParams,
}: {
  searchParams: Promise<{ duel?: string; role?: string }>;
}) {
  const params = await searchParams;
  const role = params.role === 'host' || params.role === 'joiner' ? params.role : undefined;
  return (
    <main className="page-arcade min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 pt-24">
      <div className="w-full max-w-7xl flex flex-col items-center gap-4">
        <Link href={params.duel ? '/duels' : '/'} className="self-start px-kicker">
          ← Back
        </Link>
        <GameArena duelCode={params.duel} role={role} />
      </div>
    </main>
  );
}
