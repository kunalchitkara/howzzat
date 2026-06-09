"use client";

import { useState } from "react";
import type { MatchScorecardView } from "@/lib/scorecard/types";
import { buildMatchSummary } from "@/lib/scorecard/match-summary";
import { BallByBallPanel } from "./BallByBallPanel";
import { InningsPanel } from "./InningsPanel";
import { MatchInsightsPanel, MatchSummaryPanel } from "./MatchSummaryPanel";
import "./scorecard.css";

export function ScorecardView({
  data,
  defaultView = "scorecard",
}: {
  data: MatchScorecardView;
  defaultView?: "scorecard" | "bbb";
}) {
  const [viewMode, setViewMode] = useState<"scorecard" | "bbb">(
    data.ballByBall?.innings.length ? defaultView : "scorecard",
  );
  const hasBallByBall = Boolean(data.ballByBall?.innings.length);
  const summary = buildMatchSummary(data);

  return (
    <div className="sc-wrap">
      <header className="sc-topbar">
        <h1>{data.matchTitle}</h1>
        {(data.venue || data.date) && (
          <p>
            {[data.date, data.venue].filter(Boolean).join(" · ")}
          </p>
        )}
      </header>

      {hasBallByBall && (
        <nav className="sc-view-tabs" aria-label="View">
          <button
            type="button"
            className={`sc-view-tab ${viewMode === "scorecard" ? "active" : ""}`}
            onClick={() => setViewMode("scorecard")}
          >
            Scorecard
          </button>
          <button
            type="button"
            className={`sc-view-tab ${viewMode === "bbb" ? "active" : ""}`}
            onClick={() => setViewMode("bbb")}
          >
            Ball-by-ball
          </button>
        </nav>
      )}

      {summary && viewMode === "scorecard" && (
        <MatchSummaryPanel summary={summary} />
      )}

      {viewMode === "scorecard" &&
        data.innings.map((inn, i) => (
          <InningsPanel
            key={inn.inningsLabel}
            innings={inn}
            variant={i % 2 === 1 ? "alt" : "default"}
          />
        ))}

      {viewMode === "scorecard" && summary && (
        <MatchInsightsPanel
          parentInsights={summary.parentInsights}
          coachInsights={summary.coachInsights}
        />
      )}

      {viewMode === "bbb" &&
        data.ballByBall?.innings.map((bbbInn, i) => (
          <BallByBallPanel
            key={bbbInn.label}
            innings={bbbInn}
            variant={i % 2 === 1 ? "alt" : "default"}
          />
        ))}

      {data.rulesNote && (
        <p className="sc-rules-note">{data.rulesNote}</p>
      )}
    </div>
  );
}
