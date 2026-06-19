"use client";

import { useState } from "react";
import type { MatchScorecardView } from "@/lib/scorecard/types";
import { buildMatchSummary, buildCommentaryMatchSummary } from "@/lib/scorecard/match-summary";
import { BallByBallPanel } from "./BallByBallPanel";
import { InningsPanel } from "./InningsPanel";
import { CommentaryTossPanel, MatchInsightsPanel, MatchSummaryPanel } from "./MatchSummaryPanel";
import "./scorecard.css";

type ViewMode = "scorecard" | "commentary";

export function ScorecardView({
  data,
  defaultView = "scorecard",
}: {
  data: MatchScorecardView;
  defaultView?: ViewMode;
}) {
  const hasBallByBall = Boolean(data.ballByBall?.innings.length);
  const [viewMode, setViewMode] = useState<ViewMode>(
    hasBallByBall ? defaultView : "scorecard",
  );
  const summary = buildMatchSummary(data);
  const commentarySummary = buildCommentaryMatchSummary(data);

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
            Summary
          </button>
          <button
            type="button"
            className={`sc-view-tab ${viewMode === "commentary" ? "active" : ""}`}
            onClick={() => setViewMode("commentary")}
          >
            Commentary
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

      {viewMode === "commentary" && (
        <>
          {commentarySummary && (
            <MatchSummaryPanel summary={commentarySummary} compact />
          )}
          {data.ballByBall?.innings.map((bbbInn, i) => (
            <BallByBallPanel
              key={bbbInn.label}
              innings={bbbInn}
              variant={i % 2 === 1 ? "alt" : "default"}
            />
          ))}
          {data.toss && <CommentaryTossPanel toss={data.toss} />}
        </>
      )}

      {data.rulesNote && (
        <p className="sc-rules-note">{data.rulesNote}</p>
      )}
    </div>
  );
}
