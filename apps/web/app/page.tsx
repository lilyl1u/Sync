import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-950 via-purple-900 to-black flex items-center justify-center p-8">
      <main className="text-center">
        {/* Title */}
        <h1 className="text-8xl font-bold mb-6 bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent animate-pulse">
          GEOMETRY DASH
        </h1>

        {/* Subtitle */}
        <p className="text-2xl text-purple-300 mb-4 font-mono">
          Modular • ML-Ready • Scalable
        </p>

        <p className="text-lg text-purple-400 mb-12 max-w-2xl mx-auto">
          A fully modular Geometry Dash clone built with TypeScript, Canvas rendering,
          and a pluggable architecture designed for future ML-based level generation.
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
            <h3 className="text-xl font-bold text-purple-300 mb-2">Modular Design</h3>
            <p className="text-purple-400 text-sm">
              Independent systems: Engine, Physics, Collision, Rendering
            </p>
          </div>

          <div className="bg-black/30 backdrop-blur-sm p-6 rounded-lg border border-purple-500/30">
            <h3 className="text-xl font-bold text-pink-300 mb-2">Canvas Rendering</h3>
            <p className="text-pink-400 text-sm">
              60fps performance with parallax backgrounds and effects
            </p>
          </div>

          <div className="bg-black/30 backdrop-blur-sm p-6 rounded-lg border border-purple-500/30">
            <h3 className="text-xl font-bold text-cyan-300 mb-2">ML Ready</h3>
            <p className="text-cyan-400 text-sm">
              Scalable architecture for future AI level generation
            </p>
          </div>
        </div>

        {/* Tech Stack */}
        <div className="mt-12 text-purple-400 text-sm">
          <p>Built with Next.js 15 • TypeScript • Tailwind CSS • HTML5 Canvas</p>
          <p className="mt-1">Assets sourced from HackIllinois</p>
        </div>
      </main>
    </div>
  );
}
