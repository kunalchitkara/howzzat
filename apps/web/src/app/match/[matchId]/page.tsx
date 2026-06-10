import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveScorePoll } from "@/components/live/LiveScorePoll";
import { ScorecardView } from "@/components/scorecard/ScorecardView";
import { buildMatchScorecardView } from "@/lib/scorecard/build-from-match";
import { ApiError } from "@/lib/api/http";
import { getMatch } from "@/lib/services/matches";

export const metadata = {
  title: "Match scorecard — Howzzat",
};

export default async function MatchScorecardPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;

  let data;
  let matchStatus = "SCHEDULED";
  try {
    const [scorecard, match] = await Promise.all([
      buildMatchScorecardView(matchId),
      getMatch(matchId),
    ]);
    data = scorecard;
    matchStatus = match.status;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  if (data.innings.length === 0) {
    return (
      <main style={{ background: "#eef2f7", minHeight: "100vh", padding: 24 }}>
        <div style={{ maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
          <h1 style={{ color: "var(--dk)", marginBottom: 12 }}>{data.matchTitle}</h1>
          <p style={{ color: "#666", marginBottom: 16 }}>
            No innings recorded yet. Use the scorer to start the match.
          </p>
          <Link href={`/match/${matchId}/score`} style={{ color: "var(--md)", marginRight: 12 }}>
            Score this match
          </Link>
          <Link href="/demo/scorecard" style={{ color: "var(--md)" }}>
            View demo scorecard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main style={{ background: "#eef2f7", minHeight: "100vh", padding: "0 0 24px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "12px 16px 0" }}>
        <div style={{ textAlign: "right", marginBottom: 8 }}>
          <Link href={`/match/${matchId}/score`} style={{ color: "var(--md)", fontSize: "0.85rem", fontWeight: 600 }}>
            Scorer →
          </Link>
        </div>
        <LiveScorePoll matchId={matchId} initialStatus={matchStatus} />
      </div>
      <ScorecardView data={data} />
    </main>
  );
}
