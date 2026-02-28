import { GeometryDashGame } from './components/GeometryDashGame';

export default function GamePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-purple-950 via-purple-900 to-black flex flex-col items-center justify-center p-8">
      {/* Title */}
      <div className="mb-8 text-center">
        <h1 className="text-7xl font-bold mb-4 bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
          GEOMETRY DASH
        </h1>
        <p className="text-purple-300 text-lg font-mono">
          Simple to play, impossible to put down.
        </p>
      </div>

      {/* Game Container */}
      <div className="w-full max-w-7xl">
        <GeometryDashGame width={1200} height={600} />
      </div>


    </main>
  );
}
