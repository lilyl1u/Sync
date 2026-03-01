import { WakeLofiServer } from "./components/WakeLofiServer";
import { Hero } from "./landing/Hero";

export default function Home() {
  return (
    <main className="min-h-screen relative">
      <WakeLofiServer />
      <Hero />
    </main>
  );
}
