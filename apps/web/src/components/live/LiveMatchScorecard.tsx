"use client";

import { useEffect, useState } from "react";
import type { MatchScorecardView } from "@/lib/scorecard/types";
import { apiFetch } from "@/lib/client/api";
import { ScorecardView } from "@/components/scorecard/ScorecardView";

type ScorecardResponse = {
  view: MatchScorecardView;
};

/** Parent-facing scorecard that refreshes while the match is in progress. */
export function LiveMatchScorecard({
  matchId,
  initialData,
  pollWhileLive,
}: {
  matchId: string;
  initialData: MatchScorecardView;
  pollWhileLive: boolean;
}) {
  const [data, setData] = useState(initialData);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  useEffect(() => {
    if (!pollWhileLive) return;

    let cancelled = false;

    async function poll() {
      try {
        const res = await apiFetch<ScorecardResponse>(
          `/api/v1/matches/${matchId}/scorecard`,
        );
        if (!cancelled) {
          setData(res.view);
          setUpdatedAt(new Date());
        }
      } catch {
        /* ignore transient errors */
      }
    }

    void poll();
    const id = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [matchId, pollWhileLive]);

  return (
    <>
      {pollWhileLive && (
        <p className="live-sc-updated" aria-live="polite">
          Live scorecard
          {updatedAt
            ? ` · updated ${updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : " · updates every 5s"}
        </p>
      )}
      <ScorecardView data={data} />
    </>
  );
}
