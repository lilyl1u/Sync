import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Layer 1: Gradient background */}
      <img
        src="/assets/backgrounds/first.svg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover -z-50"
        aria-hidden="true"
      />

      {/* Layer 2: Decorative blurred orbs */}
      <img
        src="/assets/Ellipse 9.svg"
        alt=""
        className="absolute -right-32 top-1/4 w-[500px] opacity-40 -z-40 blur-sm"
        aria-hidden="true"
      />
      <img
        src="/assets/Ellipse 13.svg"
        alt=""
        className="absolute -left-40 top-1/3 w-[400px] opacity-30 -z-40 blur-sm"
        aria-hidden="true"
      />
      <img
        src="/assets/Ellipse 14.svg"
        alt=""
        className="absolute left-1/3 -top-20 w-[250px] opacity-25 -z-40"
        aria-hidden="true"
      />

      {/* Layer 3: Stars */}
      <img
        src="/assets/stars.svg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover -z-30 opacity-80"
        aria-hidden="true"
      />
      <img
        src="/assets/tiny stars.svg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover -z-30 opacity-60"
        aria-hidden="true"
      />

      {/* Layer 4: Clouds */}
      <img
        src="/assets/clouds.svg"
        alt=""
        className="absolute bottom-0 w-full -z-20 opacity-40"
        aria-hidden="true"
      />

      {/* Layer 5: City silhouette */}
      <img
        src="/assets/city.svg"
        alt=""
        className="absolute bottom-0 w-full -z-10 opacity-60"
        aria-hidden="true"
      />

      {/* Content — two-column split */}
      <main className="z-10 w-full max-w-5xl mx-auto px-8 md:px-12 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
        {/* Left: Text */}
        <div className="text-center md:text-left flex flex-col items-center md:items-start">
          <h1 className="text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-purple-300 via-pink-300 to-cyan-300 bg-clip-text text-transparent drop-shadow-lg leading-tight">
            Sync
          </h1>

          <p className="text-2xl text-white mb-4 font-mono tracking-wide">
            Jump · Land · Survive
          </p>

          <p className="text-lg text-white/80 mb-6 max-w-lg leading-relaxed">
            A fast-paced dash through spikes and blocks, synced to the beat.
            One tap to jump, one mistake to restart. How far can you go?
          </p>

          <div className="flex flex-wrap gap-4 justify-center md:justify-start">
            <Link
              href="/game"
              className="inline-block px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-base font-bold rounded-full border-2 border-white hover:from-purple-500 hover:to-pink-500 transition-all duration-300 shadow-xl shadow-purple-500/40 hover:shadow-purple-500/60 hover:scale-105"
            >
              PLAY NOW <span className="ml-2">→</span>
            </Link>
            <Link
              href="/duels"
              className="inline-block px-6 py-2.5 bg-white/10 text-white text-base font-bold rounded-full border-2 border-purple-400/60 hover:bg-white/20 hover:border-purple-400 transition-all duration-300"
            >
              Duels 1v1
            </Link>
          </div>

        </div>

        {/* Right: Visual — animated game preview mockup */}
        <div className="flex items-center justify-center">
          <div className="relative w-full max-w-md aspect-square">
            {/* Glow backdrop */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 via-pink-500/10 to-cyan-500/20 rounded-3xl blur-2xl" />

            {/* Game scene card */}
            <div className="relative bg-black/40 backdrop-blur-lg rounded-3xl border border-purple-500/30 p-8 h-full flex flex-col items-center justify-center gap-6 overflow-hidden">
              {/* Ground line */}
              <div className="absolute bottom-16 left-0 right-0 h-0.5 bg-purple-500/40" />

              {/* Animated player cube */}
              <div className="absolute bottom-[68px] left-1/4 w-8 h-8 bg-gradient-to-br from-cyan-400 to-purple-500 rounded-sm rotate-0 animate-bounce shadow-lg shadow-cyan-500/50" />

              {/* Obstacles */}
              <div className="absolute bottom-16 left-[45%] w-0 h-0 border-l-[14px] border-r-[14px] border-b-[24px] border-l-transparent border-r-transparent border-b-pink-500/80" />
              <div className="absolute bottom-16 left-[60%] w-7 h-7 bg-gradient-to-br from-purple-400 to-pink-500 rounded-sm" />
              <div className="absolute bottom-16 left-[78%] w-0 h-0 border-l-[14px] border-r-[14px] border-b-[24px] border-l-transparent border-r-transparent border-b-pink-500/80" />

              {/* Title inside card */}
              <div className="text-center mb-auto pt-4">
                <div className="text-xs font-mono text-purple-400/60 mb-2 tracking-widest uppercase">Preview</div>
                <div className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  GD
                </div>
              </div>

              {/* Fake waveform bars */}
              <div className="flex items-end gap-1 h-16 mb-4">
                {[40, 65, 30, 80, 50, 70, 35, 90, 45, 60, 75, 40, 85, 55, 70, 30, 65, 80, 45, 55].map((h, i) => (
                  <div
                    key={i}
                    className="w-1.5 rounded-full bg-gradient-to-t from-purple-500 to-pink-400 opacity-60"
                    style={{
                      height: `${h}%`,
                      animation: `pulse 1.${i % 5}s ease-in-out infinite alternate`,
                      animationDelay: `${i * 0.08}s`,
                    }}
                  />
                ))}
              </div>

              {/* Beat sync label */}
              <div className="flex items-center gap-2 text-xs text-pink-300/60 font-mono">
                <span className="inline-block w-2 h-2 bg-pink-400 rounded-full animate-pulse" />
                Beat Synced
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
