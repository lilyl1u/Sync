import Link from 'next/link';
import { GeometryDashGame } from './components/GeometryDashGame';

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
        <Link
          href="/"
          className="self-start text-sm font-medium opacity-90 hover:opacity-100 transition-opacity"
          style={{ color: 'var(--arcade-cyan)' }}
        >
          ← Back
        </Link>
        <GeometryDashGame
          width={1200}
          height={600}
          duelCode={params.duel}
          role={role}
        />
      </div>
    </main>
  );
}
