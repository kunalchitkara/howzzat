"use client";

import { useState } from "react";
import type { BallByBallInnings } from "@/lib/scorecard/types";

export function BallByBallPanel({
  innings,
  variant = "default",
}: {
  innings: BallByBallInnings;
  variant?: "default" | "alt";
}) {
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  function toggleOver(over: number) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(over)) next.delete(over);
      else next.add(over);
      return next;
    });
  }

  return (
    <section className="bbb-panel">
      <div className={`sc-innings-header ${variant === "alt" ? "alt" : ""}`}>
        <span>{innings.label}</span>
        <span className="sc-innings-score">Ball-by-ball</span>
      </div>

      <div className="bbb-list">
        {innings.overs.map((over) => {
          const isOpen = !collapsed.has(over.overNumber);
          const last = over.deliveries[over.deliveries.length - 1];
          return (
            <div key={over.overNumber} className="bbb-over">
              <button
                type="button"
                className="bbb-over-head"
                onClick={() => toggleOver(over.overNumber)}
                aria-expanded={isOpen}
              >
                <div className="bbb-over-main">
                  <span className="bbb-over-num">{over.displayOver}</span>
                  {over.batterSummaries.length > 0 && (
                    <span className="bbb-over-batters">
                      {over.batterSummaries.map((b) => (
                        <span key={b.name} className="bbb-over-batter">
                          {b.name} {b.runs}
                          {b.isStriker ? "*" : ""} ({b.balls})
                        </span>
                      ))}
                      <span className="bbb-over-partnership">
                        {over.partnershipLabel}: {over.partnershipRuns}
                        {over.partnershipWickets > 0 &&
                          ` (${over.partnershipWickets} wkt)`}
                      </span>
                    </span>
                  )}
                </div>
                <span className="bbb-over-sum">
                  {over.runs} run{over.runs === 1 ? "" : "s"}
                  {over.wickets > 0 && ` · ${over.wickets} wkt`}
                </span>
                <span className="bbb-over-score">
                  {last ? `${last.totalScore}-${last.wickets}` : ""}
                </span>
                <span className="bbb-chevron">{isOpen ? "▾" : "▸"}</span>
              </button>

              {isOpen && (
                <ul className="bbb-balls">
                  {over.deliveries.map((d) => (
                    <li
                      key={d.sequence}
                      className={`bbb-ball ${d.isWicket ? "wicket" : ""} ${!d.isLegalBall ? "extra" : ""}`}
                    >
                      <span className="bbb-ball-ov">{d.displayBall}</span>
                      <span
                        className={`bbb-ball-sym ${d.symbol === "4" || d.symbol === "6" ? "boundary" : ""}`}
                      >
                        {d.symbol}
                      </span>
                      <span className="bbb-ball-text">
                        {d.description}
                        <span className="bbb-ball-meta">
                          {d.strikerName}* · {d.bowlerName}
                        </span>
                      </span>
                      <span className="bbb-ball-total">
                        {d.totalScore}-{d.wickets}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
