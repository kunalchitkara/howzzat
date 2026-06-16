"use client";

import { useState } from "react";
import type { MatchCommentary } from "@/lib/scorecard/commentary";

export function CommentaryPanel({
  commentary,
  variant = "default",
}: {
  commentary: MatchCommentary;
  variant?: "default" | "alt";
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [activeInnings, setActiveInnings] = useState(0);

  function toggleOver(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const innings = commentary.innings[activeInnings];
  if (!innings) return null;

  return (
    <section className="cmt-panel">
      {commentary.innings.length > 1 && (
        <nav className="cmt-innings-tabs" aria-label="Innings">
          {commentary.innings.map((inn, i) => (
            <button
              key={inn.label}
              type="button"
              className={`cmt-innings-tab ${i === activeInnings ? "active" : ""}`}
              onClick={() => setActiveInnings(i)}
            >
              {inn.teamName}
            </button>
          ))}
        </nav>
      )}

      <div className={`sc-innings-header ${variant === "alt" ? "alt" : ""}`}>
        <span>{innings.label}</span>
        <span className="sc-innings-score">Commentary</span>
      </div>

      <div className="cmt-list">
        {innings.overs.map((over) => {
          const key = `${activeInnings}-${over.overNumber}`;
          const isOpen = !collapsed.has(key);
          return (
            <div key={key} className="cmt-over">
              <button
                type="button"
                className="cmt-over-head"
                onClick={() => toggleOver(key)}
                aria-expanded={isOpen}
              >
                <div className="cmt-over-main">
                  <span className="cmt-over-num">{over.displayOver}</span>
                  {over.bowlerName && (
                    <span className="cmt-over-bowler">{over.bowlerName}</span>
                  )}
                  {over.batterLine && (
                    <span className="cmt-over-batters">{over.batterLine}</span>
                  )}
                  {over.partnershipLine && (
                    <span className="cmt-over-partnership">{over.partnershipLine}</span>
                  )}
                </div>
                <div className="cmt-over-right">
                  <span className="cmt-over-sum">{over.summary}</span>
                  <span className="cmt-over-score">{over.scoreAtEnd}</span>
                  <span className="cmt-chevron">{isOpen ? "▾" : "▸"}</span>
                </div>
              </button>

              {isOpen && (
                <ul className="cmt-moments">
                  {over.moments.length > 0 ? (
                    over.moments.map((m) => (
                      <li
                        key={`${key}-${m.ball}`}
                        className={`cmt-moment cmt-moment-${m.kind}`}
                      >
                        <span className="cmt-moment-ball">{m.ball}</span>
                        <span className="cmt-moment-text">{m.text}</span>
                      </li>
                    ))
                  ) : (
                    <li className="cmt-moment cmt-moment-quiet">
                      <span className="cmt-moment-text">Quiet over — no major incidents</span>
                    </li>
                  )}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
