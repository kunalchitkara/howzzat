"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client/api";

type LiveSnapshot = {
  status: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  marginText: string | null;
  innings: {
    inningsNumber: number;
    teamName: string;
    totalRuns: number;
    wickets: number;
    overs: number;
    complete: boolean;
  }[];
};

export function LiveScorePoll({
  matchId,
  initialStatus,
}: {
  matchId: string;
  initialStatus: string;
}) {
  const [live, setLive] = useState<LiveSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const data = await apiFetch<LiveSnapshot>(`/api/v1/matches/${matchId}/live`);
        if (!cancelled) setLive(data);
      } catch {
        /* ignore transient errors */
      }
    }

    if (initialStatus === "LIVE" || live?.status === "LIVE") {
      void poll();
      const id = setInterval(poll, 5000);
      return () => {
        cancelled = true;
        clearInterval(id);
      };
    }
    void poll();
    return () => {
      cancelled = true;
    };
  }, [matchId, initialStatus, live?.status]);

  if (!live || live.innings.length === 0) return null;

  const active = live.innings.find((i) => !i.complete) ?? live.innings.at(-1);

  return (
    <div
      style={{
        background: "linear-gradient(135deg, var(--dk), var(--md))",
        color: "#fff",
        borderRadius: 12,
        padding: "16px 20px",
        marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 800, fontSize: "0.75rem", letterSpacing: 1 }}>
          {live.status === "LIVE" ? "● LIVE" : live.status}
        </span>
        {live.marginText && (
          <span style={{ fontSize: "0.85rem", opacity: 0.9 }}>{live.marginText}</span>
        )}
      </div>
      <p style={{ fontSize: "1.25rem", fontWeight: 700, marginTop: 8 }}>
        {live.homeTeam} {live.homeScore ?? "—"} – {live.awayScore ?? "—"} {live.awayTeam}
      </p>
      {active && (
        <p style={{ fontSize: "0.9rem", opacity: 0.9, marginTop: 4 }}>
          {active.teamName}: {active.totalRuns}/{active.wickets} ({active.overs} ov)
        </p>
      )}
    </div>
  );
}
