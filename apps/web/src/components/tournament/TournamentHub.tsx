"use client";

import Link from "next/link";
import { useState } from "react";
import { matchScorecardPath } from "@/lib/match-slug";
import {
  clubSeasonRecord,
  fixtureHasScorecard,
  fixtureResultLabel,
  fixtureScorecardPath,
} from "@/lib/tournament/hub-utils";
import type { TournamentInsights } from "@/lib/tournament/insights";

type Tab = "overview" | "fixtures" | "matches" | "leaders" | "players";

export function TournamentHub({
  orgName,
  tournamentName,
  ageGroup,
  seasonLabel,
  rulesName,
  teams,
  clubTeamIds = [],
  insights,
}: {
  orgName: string;
  tournamentName: string;
  ageGroup?: string | null;
  seasonLabel?: string | null;
  rulesName?: string | null;
  teams: { id: string; name: string }[];
  clubTeamIds?: string[];
  insights: TournamentInsights;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const { overview, standings, leaderboards, playerStats, fixtures } = insights;

  const nextFixture = fixtures.find(
    (f) => f.status === "SCHEDULED" || f.isLive,
  );

  const clubRecord =
    clubTeamIds.length > 0
      ? clubSeasonRecord(standings, clubTeamIds)
      : null;

  const playedFixtures = fixtures.filter((f) => fixtureHasScorecard(f));

  return (
    <>
      <header className="th-header">
        <div className="th-header-inner">
          <p className="th-org">{orgName}</p>
          <h1 className="th-title">{tournamentName}</h1>
          <p className="th-meta">
            {[ageGroup, seasonLabel, rulesName].filter(Boolean).join(" · ")}
          </p>
          {seasonLabel && <span className="th-stage">{seasonLabel}</span>}
        </div>
      </header>

      <nav className="th-nav" aria-label="Tournament sections">
        {(
          [
            ["overview", "📋 Overview"],
            ["fixtures", "📅 Fixtures"],
            ["matches", "🏏 Matches"],
            ["leaders", "🏆 Leaders"],
            ["players", "👤 Players"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`th-nav-btn ${tab === id ? "active" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="th-body">
        {nextFixture && tab === "overview" && (
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
            {fixtureHasScorecard(nextFixture) ? (
              <Link href={fixtureScorecardPath(nextFixture)} className="th-score-link">
                {nextFixture.isLive ? "Watch live scorecard" : "View match"}
              </Link>
            ) : (
              <p className="th-next-date">Fixture scheduled — scorecard after toss</p>
            )}
          </section>
        )}

        {tab === "overview" && (
          <>
            <section className="th-card">
              <h2 className="th-card-title">Season at a glance</h2>
              <div className="th-stat-grid">
                {clubRecord && clubRecord.played > 0 ? (
                  <>
                    <div className="th-stat">
                      <span className="th-stat-val">{clubRecord.played}</span>
                      <span className="th-stat-lbl">Played</span>
                    </div>
                    <div className="th-stat th-stat-win">
                      <span className="th-stat-val">{clubRecord.won}</span>
                      <span className="th-stat-lbl">Wins</span>
                    </div>
                    <div className="th-stat th-stat-loss">
                      <span className="th-stat-val">{clubRecord.lost}</span>
                      <span className="th-stat-lbl">Losses</span>
                    </div>
                    {clubRecord.drawn > 0 && (
                      <div className="th-stat">
                        <span className="th-stat-val">{clubRecord.drawn}</span>
                        <span className="th-stat-lbl">Draws</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
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
                  </>
                )}
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

            {fixtures.length > 0 && (
              <section className="th-card">
                <h2 className="th-card-title">Season results</h2>
                <div className="th-table-wrap">
                  <table className="th-table th-table-results">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Match</th>
                        <th>Result</th>
                        <th className="th-col-scorecard">Scorecard</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fixtures.map((f) => (
                        <tr key={f.id}>
                          <td>{f.matchNumber ?? "—"}</td>
                          <td>
                            <strong>
                              {f.homeTeam} vs {f.awayTeam}
                            </strong>
                            {f.scheduledAt && (
                              <span className="th-row-meta"> · {f.scheduledAt}</span>
                            )}
                          </td>
                          <td>
                            {f.isLive && <span className="th-live">● LIVE · </span>}
                            {fixtureResultLabel(f)}
                          </td>
                          <td className="th-col-scorecard">
                            {fixtureHasScorecard(f) ? (
                              <Link
                                href={fixtureScorecardPath(f)}
                                className="th-score-link th-score-link-inline"
                              >
                                📊 Scorecard
                              </Link>
                            ) : (
                              <span className="th-muted">TBD</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

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
              <div className="th-table-wrap">
                <table className="th-table th-table-results">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Match</th>
                      <th>Venue</th>
                      <th>Result</th>
                      <th className="th-col-scorecard">Scorecard</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fixtures.map((f) => (
                      <tr key={f.id}>
                        <td>{f.matchNumber ?? "—"}</td>
                        <td>
                          <strong>
                            {f.homeTeam} vs {f.awayTeam}
                          </strong>
                          {f.scheduledAt && (
                            <span className="th-row-meta"> · {f.scheduledAt}</span>
                          )}
                        </td>
                        <td className="th-muted">{f.venue ?? "—"}</td>
                        <td>
                          {f.isLive && <span className="th-live">● LIVE · </span>}
                          {fixtureResultLabel(f)}
                        </td>
                        <td className="th-col-scorecard">
                          {fixtureHasScorecard(f) ? (
                            <Link
                              href={fixtureScorecardPath(f)}
                              className="th-score-link th-score-link-inline"
                            >
                              📊
                            </Link>
                          ) : (
                            <span className="th-muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {tab === "matches" && (
          <section className="th-card">
            <h2 className="th-card-title">Match scorecards</h2>
            {playedFixtures.length === 0 ? (
              <p className="th-empty">
                Match scorecards appear once play begins or results are recorded.
              </p>
            ) : (
              <ul className="th-match-cards">
                {playedFixtures.map((f) => (
                  <li key={f.id} className="th-match-card">
                    <div className="th-match-card-head">
                      <span className="th-fixture-num">
                        {f.matchNumber != null ? `M${f.matchNumber}` : "Match"}
                      </span>
                      <div>
                        <strong>
                          {f.homeTeam} vs {f.awayTeam}
                        </strong>
                        <p className="th-fixture-meta">
                          {f.scheduledAt}
                          {f.venue ? ` · ${f.venue}` : ""}
                        </p>
                      </div>
                    </div>
                    <p className="th-match-card-result">
                      {f.isLive && <span className="th-live">● LIVE · </span>}
                      {fixtureResultLabel(f)}
                    </p>
                    <Link href={fixtureScorecardPath(f)} className="th-score-link">
                      Open scorecard & commentary →
                    </Link>
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
                    <h3 className="th-lb-head">
                      {board.emoji} {board.title}
                    </h3>
                    <ol className="th-lb-list">
                      {board.entries.map((e) => (
                        <li key={`${board.title}-${e.rank}`} className="th-lb-entry">
                          <span className={`th-lb-rank ${e.rank <= 3 ? `r${e.rank}` : ""}`}>
                            {e.rank}
                          </span>
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
              <>
                <div className="th-player-grid">
                  {playerStats.slice(0, 12).map((p) => (
                    <article key={p.playerId} className="th-player-card">
                      <div className="th-player-name">
                        {p.name}
                        <span>{p.teamName}</span>
                      </div>
                      <div className="th-player-stats">
                        <div className="th-player-stat">
                          <span className="th-player-stat-val">{p.runs}</span>
                          <span className="th-player-stat-lbl">Runs</span>
                        </div>
                        <div className="th-player-stat">
                          <span className="th-player-stat-val">
                            {p.balls > 0 ? p.strikeRate : "—"}
                          </span>
                          <span className="th-player-stat-lbl">SR</span>
                        </div>
                        <div className="th-player-stat">
                          <span className="th-player-stat-val">
                            {p.netRuns >= 0 ? `+${p.netRuns}` : p.netRuns}
                          </span>
                          <span className="th-player-stat-lbl">Net</span>
                        </div>
                        <div className="th-player-stat">
                          <span className="th-player-stat-val">{p.wickets || "—"}</span>
                          <span className="th-player-stat-lbl">Wkts</span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
                {playerStats.length > 12 && (
                  <div className="th-table-wrap" style={{ marginTop: 16 }}>
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
              </>
            )}
          </section>
        )}

        <div className="th-footer">
          <Link href="/" className="th-footer-link">
            Howzzat home
          </Link>
          <Link href="/login" className="th-footer-link">
            Club login
          </Link>
        </div>
      </div>
    </>
  );
}
