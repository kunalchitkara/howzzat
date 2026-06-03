"use client";

import { useState } from "react";
import type { MatchScorecardView } from "@/lib/scorecard/types";
import { BallByBallPanel } from "./BallByBallPanel";
import { InningsPanel } from "./InningsPanel";
import "./scorecard.css";

export function ScorecardView({
  data,
  defaultView = "scorecard",
}: {
  data: MatchScorecardView;
  defaultView?: "scorecard" | "bbb";
}) {
  const [activeInnings, setActiveInnings] = useState(0);
  const [viewMode, setViewMode] = useState<"scorecard" | "bbb">(
    data.ballByBall?.innings.length ? defaultView : "scorecard",
  );
  const hasBallByBall = Boolean(data.ballByBall?.innings.length);
  const innings = data.innings[activeInnings];

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

      {data.innings.length > 1 && viewMode === "scorecard" && (
        <nav className="sc-tabs" aria-label="Innings">
          {data.innings.map((inn, i) => (
            <button
              key={inn.inningsLabel}
              type="button"
              className={`sc-tab ${i === activeInnings ? "active" : ""}`}
              onClick={() => setActiveInnings(i)}
            >
              {inn.teamName}
            </button>
          ))}
        </nav>
      )}

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

      {data.resultBanner && (
        <div className={`sc-result ${data.resultBanner.variant}`}>
          <div className="sc-result-text">{data.resultBanner.text}</div>
          {data.resultBanner.subtext && (
            <div className="sc-result-sub">{data.resultBanner.subtext}</div>
          )}
        </div>
      )}

      {viewMode === "scorecard" && innings && (
        <InningsPanel
          innings={innings}
          variant={activeInnings % 2 === 1 ? "alt" : "default"}
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
