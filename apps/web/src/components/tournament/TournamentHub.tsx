"use client";

import { useState } from "react";
import { BtnLink } from "@/components/dashboard/ui";
import { matchPublicRef } from "@/lib/match-slug";
import type { TournamentInsights } from "@/lib/tournament/insights";

type Tab = "overview" | "fixtures" | "leaders" | "players";

export function TournamentHub({
  orgName,
  tournamentName,
  ageGroup,
  seasonLabel,
  rulesName,
  teams,
  insights,
}: {
  orgName: string;
  tournamentName: string;
  ageGroup?: string | null;
  seasonLabel?: string | null;
  rulesName?: string | null;
  teams: { id: string; name: string }[];
  insights: TournamentInsights;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const { overview, standings, leaderboards, playerStats, fixtures } = insights;

  const nextFixture = fixtures.find(
    (f) => f.status === "SCHEDULED" || f.isLive,
  );

  return (
    <>
      <header className="th-header">
        <div className="th-header-inner">
          <p className="th-org">{orgName}</p>
          <h1 className="th-title">{tournamentName}</h1>
          <p className="th-meta">
            {[ageGroup, seasonLabel, rulesName].filter(Boolean).join(" · ")}
          </p>
        </div>
      </header>

      <div className="th-body">
        {nextFixture && (
          <section className="th-next-match">
            <p className="th-next-label">
              {nextFixture.isLive ? "🔴 Live now" : "📅 Next match"}
            </p>
            <p className="th-next-teams">
              {nextFixture.homeTeam} vs {nextFixture.awayTeam}
            </p>
            {nextFixture.scheduledAt && (
              <p className="th-next-date">{nextFixture.scheduledAt}</p>
            )}
            <BtnLink href={`/match/${matchPublicRef(nextFixture)}`} className="btn-nav">
              {nextFixture.isLive ? "Watch live" : "View match"}
            </BtnLink>
          </section>
        )}

        <nav className="th-tabs" aria-label="Tournament sections">
          {(
            [
              ["overview", "📋 Overview"],
              ["fixtures", "📅 Fixtures"],
              ["leaders", "🏆 Leaders"],
              ["players", "👤 Players"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`th-tab ${tab === id ? "active" : ""}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        {tab === "overview" && (
          <>
            <section className="th-card">
              <h2 className="th-card-title">Season at a glance</h2>
              <div className="th-stat-grid">
                <div className="th-stat">
                  <span className="th-stat-val">{overview.matchesPlayed}</span>
                  <span className="th-stat-lbl">Played</span>
                </div>
                <div className="th-stat">
                  <span className="th-stat-val">{overview.liveMatches}</span>
                  <span className="th-stat-lbl">Live</span>
                </div>
                <div className="th-stat">
                  <span className="th-stat-val">{overview.matchesScheduled}</span>
                  <span className="th-stat-lbl">Upcoming</span>
                </div>
                {overview.highestTeamScore > 0 && (
                  <div className="th-stat">
                    <span className="th-stat-val">{overview.highestTeamScore}</span>
                    <span className="th-stat-lbl">Highest score</span>
                  </div>
                )}
                {overview.bestWinMargin > 0 && (
                  <div className="th-stat">
                    <span className="th-stat-val">+{overview.bestWinMargin}</span>
                    <span className="th-stat-lbl">Best win margin</span>
                  </div>
                )}
              </div>
            </section>

            {standings.length > 0 && (
              <section className="th-card">
                <h2 className="th-card-title">Standings</h2>
                <div className="th-table-wrap">
                  <table className="th-table">
                    <thead>
                      <tr>
                        <th>Team</th>
                        <th>P</th>
                        <th>W</th>
                        <th>L</th>
                        <th>Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((s) => (
                        <tr key={s.teamId}>
                          <td>{s.teamName}</td>
                          <td>{s.played}</td>
                          <td>{s.won}</td>
                          <td>{s.lost}</td>
                          <td><strong>{s.points}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <section className="th-card">
              <h2 className="th-card-title">Teams ({teams.length})</h2>
              <ul className="th-team-pills">
                {teams.map((t) => (
                  <li key={t.id} className="th-team-pill">
                    {t.name}
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}

        {tab === "fixtures" && (
          <section className="th-card">
            <h2 className="th-card-title">Fixtures & results</h2>
            {fixtures.length === 0 ? (
              <p className="th-empty">Fixtures will appear here once scheduled.</p>
            ) : (
              <ul className="th-fixtures">
                {fixtures.map((f) => (
                  <li key={f.id} className="th-fixture">
                    <div className="th-fixture-main">
                      {f.matchNumber != null && (
                        <span className="th-fixture-num">M{f.matchNumber}</span>
                      )}
                      <div>
                        <strong>
                          {f.homeTeam} vs {f.awayTeam}
                        </strong>
                        <p className="th-fixture-meta">
                          {f.isLive && (
                            <span className="th-live">● LIVE · </span>
                          )}
                          {f.homeScore != null && f.awayScore != null
                            ? `${f.homeScore} – ${f.awayScore}`
                            : f.status}
                          {f.marginText ? ` · ${f.marginText}` : ""}
                          {f.scheduledAt ? ` · ${f.scheduledAt}` : ""}
                          {f.venue ? ` · ${f.venue}` : ""}
                        </p>
                      </div>
                    </div>
                    <BtnLink href={`/match/${matchPublicRef(f)}`} className="btn-nav">
                      Scorecard
                    </BtnLink>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {tab === "leaders" && (
          <section className="th-card">
            <h2 className="th-card-title">Season leaderboards</h2>
            {leaderboards.length === 0 ? (
              <p className="th-empty">
                Leaderboards appear after matches are played.
              </p>
            ) : (
              <div className="th-leaderboards">
                {leaderboards.map((board) => (
                  <div key={board.title} className="th-leaderboard">
                    <h3 className="th-lb-title">
                      {board.emoji} {board.title}
                    </h3>
                    <ol className="th-lb-list">
                      {board.entries.map((e) => (
                        <li key={`${board.title}-${e.rank}`} className="th-lb-entry">
                          <span className="th-lb-rank">{e.rank}</span>
                          <div className="th-lb-info">
                            <span className="th-lb-name">{e.name}</span>
                            <span className="th-lb-team">{e.teamName}</span>
                          </div>
                          <span className="th-lb-value">{e.value}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "players" && (
          <section className="th-card">
            <h2 className="th-card-title">Player stats</h2>
            {playerStats.length === 0 ? (
              <p className="th-empty">
                Player stats appear after innings are recorded.
              </p>
            ) : (
              <div className="th-table-wrap">
                <table className="th-table th-table-players">
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Team</th>
                      <th>R</th>
                      <th>SR</th>
                      <th>Net</th>
                      <th>Wkts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {playerStats.map((p) => (
                      <tr key={p.playerId}>
                        <td>{p.name}</td>
                        <td className="th-muted">{p.teamName}</td>
                        <td>{p.runs}</td>
                        <td>{p.balls > 0 ? p.strikeRate : "—"}</td>
                        <td>{p.netRuns >= 0 ? `+${p.netRuns}` : p.netRuns}</td>
                        <td>{p.wickets || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        <div className="btn-group th-footer">
          <BtnLink href="/" variant="secondary" className="btn-nav">
            Howzzat home
          </BtnLink>
          <BtnLink href="/login" className="btn-nav">
            Club login
          </BtnLink>
        </div>
      </div>
    </>
  );
}
