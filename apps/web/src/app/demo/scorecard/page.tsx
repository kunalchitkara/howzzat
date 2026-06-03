import { ScorecardView } from "@/components/scorecard/ScorecardView";
import { edgwareM4DemoScorecard } from "@/lib/scorecard/demo-edgware-m4";

export const metadata = {
  title: "Scorecard demo — Howzzat",
  description: "U9 Softball scorecard inspired by Cricbuzz and Edgware CC",
};

export default function DemoScorecardPage() {
  return (
    <main style={{ background: "#eef2f7", minHeight: "100vh", padding: "0 0 24px" }}>
      <ScorecardView data={edgwareM4DemoScorecard} />
    </main>
  );
}
