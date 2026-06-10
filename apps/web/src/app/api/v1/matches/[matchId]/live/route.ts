import { json } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { getMatch } from "@/lib/services/matches";
import { getMatchScoringContext } from "@/lib/services/scoring";

export const runtime = "nodejs";

/** Lightweight live snapshot for spectator polling */
export const GET = withApi(async (_request, { params }) => {
  const { matchId } = await params;
  const match = await getMatch(matchId);
  const ctx = await getMatchScoringContext(matchId);

  const innings = ctx.innings.map((inn) => ({
    inningsNumber: inn.inningsNumber,
    teamName: inn.battingTeamName,
    totalRuns: inn.totalRuns,
    wickets: inn.wickets,
    overs: inn.oversBowled,
    complete: inn.complete,
  }));

  return json({
    data: {
      matchId: match.id,
      status: match.status,
      homeTeam: ctx.homeTeam.name,
      awayTeam: ctx.awayTeam.name,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      marginText: match.marginText,
      activeInningsId: ctx.activeInningsId,
      innings,
      updatedAt: new Date().toISOString(),
    },
  });
});
