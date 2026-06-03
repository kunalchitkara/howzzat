import { json } from "@/lib/api/http";
import { generateSimulatedScorecard } from "@/lib/scorecard/simulated";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const seedParam = searchParams.get("seed");
  const seed = seedParam ? Number(seedParam) : undefined;

  const view = generateSimulatedScorecard({
    seed: Number.isFinite(seed) ? seed : undefined,
    homeTeam: searchParams.get("home") ?? undefined,
    awayTeam: searchParams.get("away") ?? undefined,
  });

  return json({ data: view });
}
