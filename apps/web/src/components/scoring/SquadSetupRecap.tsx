import type { MatchScoringContext } from "@/lib/scoring/types";

export function SquadSetupRecap({ ctx }: { ctx: MatchScoringContext }) {
  const overs = ctx.matchTotalOvers ?? ctx.totalOvers;

  return (
    <aside className="sp-setup-recap" aria-label="Match setup">
      <p className="sp-setup-recap-meta">
        <span className="sp-setup-recap-overs">
          <strong>{overs}</strong> overs per innings
        </span>
        <span className="sp-setup-recap-sep">·</span>
        <span>
          {ctx.squads.home.length} v {ctx.squads.away.length} players
        </span>
      </p>
      <div className="sp-setup-recap-teams">
        {(["home", "away"] as const).map((side) => {
          const team = side === "home" ? ctx.homeTeam : ctx.awayTeam;
          const squad = side === "home" ? ctx.squads.home : ctx.squads.away;
          return (
            <div key={side} className="sp-setup-recap-side">
              <h4>{team.name}</h4>
              <ul>
                {squad.map((p) => (
                  <li key={p.id}>
                    {p.name}
                    {p.isCaptain && <span className="sp-captain-mark"> (c)</span>}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
