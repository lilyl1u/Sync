import { WakeLofiServer } from "./components/WakeLofiServer";
import { PrefetchRoutes } from "./components/PrefetchRoutes";
import { Hero } from "./landing/Hero";

export default function Home() {
  return (
    <main className="min-h-screen relative">
      <WakeLofiServer />
      <PrefetchRoutes />
      <Hero />
    </main>
  );
}
