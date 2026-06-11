"use client";

import { useState } from "react";
import type { MatchSummary } from "@/lib/scorecard/match-summary";

export function MatchSummaryPanel({ summary }: { summary: MatchSummary }) {
  return (
    <section className="ms-panel">
      <div className={`ms-hero ms-hero-${summary.variant}`}>
        <h2 className="ms-headline">{summary.headline}</h2>
        {summary.meta && <p className="ms-meta">{summary.meta}</p>}
      </div>

      <div className="ms-stat-grid">
        {summary.scores.map((s) => (
          <div key={s.label} className="ms-stat">
            <span className="ms-stat-val">{s.value}</span>
            <span className="ms-stat-lbl">{s.label}</span>
          </div>
        ))}
        {summary.scores.length >= 2 && (
          <div className="ms-stat">
            <span className="ms-stat-val">{summary.marginValue}</span>
            <span className="ms-stat-lbl">{summary.marginLabel}</span>
          </div>
        )}
        {summary.overs > 0 && (
          <div className="ms-stat">
            <span className="ms-stat-val">{summary.overs}</span>
            <span className="ms-stat-lbl">Overs</span>
          </div>
        )}
      </div>

      {(summary.highlights.length > 0 || summary.playerOfMatch) && (
        <div className="ms-highlights">
          {summary.highlights.map((h) => (
            <div key={h.label} className="ms-highlight">
              <span className="ms-hl-lbl">{h.label}</span>
              <span className="ms-hl-name">{h.name}</span>
              <span className="ms-hl-detail">{h.detail}</span>
            </div>
          ))}
          {summary.playerOfMatch && (
            <div className="ms-highlight ms-potm">
              <span className="ms-hl-lbl">⭐ Player of the match</span>
              <span className="ms-hl-name">{summary.playerOfMatch.name}</span>
              <span className="ms-hl-detail">{summary.playerOfMatch.detail}</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export function MatchInsightsPanel({
  parentInsights,
  coachInsights,
}: {
  parentInsights: MatchSummary["parentInsights"];
  coachInsights: MatchSummary["coachInsights"];
}) {
  const [audience, setAudience] = useState<"parents" | "coaches">("parents");
  const coachAll = (() => {
    const seen = new Set<string>();
    const merged = [];
    for (const ins of [...parentInsights, ...coachInsights]) {
      if (seen.has(ins.title)) continue;
      seen.add(ins.title);
      merged.push(ins);
    }
    return merged;
  })();
  const insights = audience === "parents" ? parentInsights : coachAll;

  if (!parentInsights.length && !coachInsights.length) return null;

  return (
    <section className={`ms-insights ${audience === "coaches" ? "ms-insights-coach" : ""}`}>
      <div className="ms-insights-head">
        <h3 className="ms-insights-title">
          {audience === "parents" ? "🌟 For parents" : "📋 For coaches"}
        </h3>
        <nav className="ms-insights-tabs" aria-label="Insights audience">
          <button
            type="button"
            className={`ms-insights-tab ${audience === "parents" ? "active" : ""}`}
            onClick={() => setAudience("parents")}
          >
            Parents
          </button>
          <button
            type="button"
            className={`ms-insights-tab ${audience === "coaches" ? "active" : ""}`}
            onClick={() => setAudience("coaches")}
          >
            Coaches
          </button>
        </nav>
      </div>
      <p className="ms-insights-intro">
        {audience === "parents"
          ? "Highlights and encouragement from the match — perfect for the car ride home."
          : "Full match facts for training — positives and areas to work on."}
      </p>
      <ul className="ms-insights-list">
        {insights.map((ins) => (
          <li key={`${audience}-${ins.title}`} className="ms-insight">
            <span className="ms-insight-emoji" aria-hidden>
              {ins.emoji}
            </span>
            <div>
              <strong className="ms-insight-title">{ins.title}</strong>
              <p className="ms-insight-body">{ins.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
