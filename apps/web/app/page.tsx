import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8 relative overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0 -z-20"
        style={{
          backgroundImage: 'url(/landing-bg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      {/* Dark overlay to keep it slightly dark */}
      <div className="absolute inset-0 bg-gradient-to-b from-purple-950/75 via-purple-950/55 to-black/85 -z-10" />
      <main className="text-center">
        {/* Title */}
        <h1 className="text-8xl font-bold mb-6 bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent animate-pulse">
          GEOMETRY DASH
        </h1>

        {/* Subtitle */}
        <p className="text-2xl text-purple-300 mb-4 font-mono">
          Jump • Land • Survive
        </p>

        <p className="text-lg text-purple-400 mb-12 max-w-2xl mx-auto">
          A fast-paced dash through spikes and blocks. One tap to jump, one mistake to restart.
          How far can you go?
        </p>

        {/* Play Button */}
        <Link
          href="/game"
          className="inline-block px-12 py-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-2xl font-bold rounded-2xl hover:from-purple-500 hover:to-pink-500 transition-all shadow-2xl shadow-purple-500/50 hover:shadow-purple-500/70 hover:scale-105"
        >
          PLAY NOW
        </Link>

        {/* Features */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="bg-black/30 backdrop-blur-sm p-6 rounded-lg border border-purple-500/30">
            <h3 className="text-xl font-bold text-purple-300">Simple Controls</h3>
          </div>

          <div className="bg-black/30 backdrop-blur-sm p-6 rounded-lg border border-purple-500/30">
            <h3 className="text-xl font-bold text-pink-300">Smooth Gameplay</h3>
          </div>

          <div className="bg-black/30 backdrop-blur-sm p-6 rounded-lg border border-purple-500/30">
            <h3 className="text-xl font-bold text-cyan-300">Endless Retries</h3>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-purple-400 text-sm">
          <p>Assets from HackIllinois</p>
        </div>
      </main>
    </div>
  );
}
