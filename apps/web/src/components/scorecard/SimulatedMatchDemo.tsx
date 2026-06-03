"use client";

import { useCallback, useState } from "react";
import { ScorecardView } from "@/components/scorecard/ScorecardView";
import type { MatchScorecardView } from "@/lib/scorecard/types";
import "@/components/scorecard/scorecard.css";
import "@/components/scorecard/simulated.css";

async function fetchSimulated(seed?: number): Promise<MatchScorecardView> {
  const url =
    seed != null
      ? `/api/demo/simulated?seed=${seed}`
      : `/api/demo/simulated?t=${Date.now()}`;
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error?.message ?? "Simulation failed");
  }
  return body.data as MatchScorecardView;
}

export function SimulatedMatchDemo({
  initialScorecard,
  initialSeed,
}: {
  initialScorecard: MatchScorecardView;
  initialSeed: number;
}) {
  const [scorecard, setScorecard] = useState(initialScorecard);
  const [seed, setSeed] = useState<number | "">(initialSeed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const regenerate = useCallback(async (explicitSeed?: number) => {
    setBusy(true);
    setError(null);
    try {
      const next = await fetchSimulated(explicitSeed);
      setScorecard(next);
      const match = next.resultBanner?.subtext?.match(/seed (\d+)/);
      if (match?.[1]) setSeed(Number(match[1]));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <>
      <div className="sim-toolbar">
        <button
          type="button"
          className="sim-btn"
          disabled={busy}
          onClick={() => regenerate()}
        >
          {busy ? "Simulating…" : "New random match"}
        </button>
        <form
          className="sim-seed-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (seed !== "") regenerate(Number(seed));
          }}
        >
          <input
            type="number"
            placeholder="Seed"
            value={seed}
            onChange={(e) =>
              setSeed(e.target.value === "" ? "" : Number(e.target.value))
            }
            aria-label="Simulation seed"
          />
          <button type="submit" className="sim-btn secondary" disabled={busy}>
            Replay seed
          </button>
        </form>
      </div>
      {error && <p className="sim-error">{error}</p>}
      <ScorecardView data={scorecard} defaultView="bbb" />
    </>
  );
}
