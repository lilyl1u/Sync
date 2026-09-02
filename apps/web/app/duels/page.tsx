import Link from 'next/link';
import { DuelsClient } from './DuelsClient';

export default function DuelsPage() {
  return (
    <div className="page-arcade min-h-screen relative overflow-hidden">
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16 pt-24">
        <Link href="/" className="absolute top-20 left-6 px-kicker">
          ← Home
        </Link>

        <div className="mb-10 text-center">
          <h1 className="px-title text-3xl sm:text-4xl mb-3">DUELS</h1>
          <p className="px-kicker" style={{ color: 'var(--px-gold)' }}>
            1v1 · Winner takes the pot
          </p>
        </div>

        <DuelsClient />
      </div>
    </div>
  );
}
