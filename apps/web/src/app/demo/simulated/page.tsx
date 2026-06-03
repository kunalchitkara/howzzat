import { SimulatedMatchDemo } from "@/components/scorecard/SimulatedMatchDemo";
import { generateSimulatedScorecard } from "@/lib/scorecard/simulated";
import "@/components/scorecard/simulated.css";

export const metadata = {
  title: "Simulated match — Howzzat",
  description: "Random U9 match simulation with full scorecard",
};

export const dynamic = "force-dynamic";

export default function SimulatedMatchPage() {
  const seed = Math.floor(Math.random() * 2147483647);
  const scorecard = generateSimulatedScorecard({ seed });

  return (
    <main style={{ background: "#eef2f7", minHeight: "100vh", paddingBottom: 24 }}>
      <SimulatedMatchDemo initialScorecard={scorecard} initialSeed={seed} />
    </main>
  );
}
