"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { applyStrikeRotationsAfterDelivery } from "@howzzat/rules-engine";
import type { DeliveryEvent } from "@howzzat/rules-engine";
import type { MatchScoringContext } from "@/lib/scoring/types";
import { formatOver } from "@/lib/scoring/ball-position";
import "./scorepad.css";

type WicketKind = "bowled" | "caught" | "run_out" | "lbw" | "stumped";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error?.message ?? body?.message ?? "Request failed");
  }
  return body.data as T;
}

export function ScorePad({ matchId }: { matchId: string }) {
  const [ctx, setCtx] = useState<MatchScoringContext | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [strikerId, setStrikerId] = useState("");
  const [nonStrikerId, setNonStrikerId] = useState("");
  const [bowlerId, setBowlerId] = useState("");

  const [wicketOpen, setWicketOpen] = useState(false);
  const [wicketType, setWicketType] = useState<WicketKind>("bowled");
  const [fielderId, setFielderId] = useState("");
  const [dismissedId, setDismissedId] = useState("");

  const refresh = useCallback(async () => {
    const data = await api<MatchScoringContext>(
      `/api/v1/matches/${matchId}/scoring`,
    );
    setCtx(data);
    return data;
  }, [matchId]);

  useEffect(() => {
    refresh().catch((e) => setError(String(e.message ?? e)));
  }, [refresh]);

  const activeInnings = useMemo(
    () => ctx?.innings.find((i) => i.id === ctx.activeInningsId) ?? null,
    [ctx],
  );

  const battingSquad = useMemo(() => {
    if (!ctx || !activeInnings) return [];
    return activeInnings.battingTeamId === ctx.homeTeam.id
      ? ctx.squads.home
      : ctx.squads.away;
  }, [ctx, activeInnings]);

  const bowlingSquad = useMemo(() => {
    if (!ctx || !activeInnings) return [];
    return activeInnings.battingTeamId === ctx.homeTeam.id
      ? ctx.squads.away
      : ctx.squads.home;
  }, [ctx, activeInnings]);

  useEffect(() => {
    if (!battingSquad.length || strikerId) return;
    setStrikerId(battingSquad[0]?.id ?? "");
    setNonStrikerId(battingSquad[1]?.id ?? battingSquad[0]?.id ?? "");
  }, [battingSquad, strikerId]);

  useEffect(() => {
    if (!bowlingSquad.length || bowlerId) return;
    setBowlerId(bowlingSquad[0]?.id ?? "");
  }, [bowlingSquad, bowlerId]);

  async function runAction(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveSquads() {
    if (!ctx) return;
    await runAction(async () => {
      await api(`/api/v1/matches/${matchId}/squad`, {
        method: "POST",
        body: JSON.stringify({
          teamId: ctx.homeTeam.teamId,
          playerIds: ctx.squads.home.map((p) => p.id),
        }),
      });
      await api(`/api/v1/matches/${matchId}/squad`, {
        method: "POST",
        body: JSON.stringify({
          teamId: ctx.awayTeam.teamId,
          playerIds: ctx.squads.away.map((p) => p.id),
        }),
      });
    });
  }

  async function startInnings() {
    if (!ctx?.canStartInnings) return;
    await runAction(async () => {
      await api(`/api/v1/matches/${matchId}/innings`, {
        method: "POST",
        body: JSON.stringify({
          battingTeamId: ctx.canStartInnings!.battingTeamId,
          inningsNumber: ctx.canStartInnings!.inningsNumber,
        }),
      });
      setStrikerId("");
      setNonStrikerId("");
      setBowlerId("");
    });
  }

  async function postDelivery(payload: Record<string, unknown>) {
    if (!activeInnings || !ctx) return;
    const ball = activeInnings.nextBall;
    const event: DeliveryEvent = {
      overNumber: ball.overNumber,
      ballInOver: ball.ballInOver,
      strikerId,
      nonStrikerId,
      bowlerId,
      runsOffBat: Number(payload.runsOffBat ?? 0),
      extrasRuns: Number(payload.extrasRuns ?? 0),
      isLegalBall: payload.isLegalBall !== false,
      extrasType: payload.extrasType as DeliveryEvent["extrasType"],
      wicketType: payload.wicketType as DeliveryEvent["wicketType"],
      dismissedBatsmanId: payload.dismissedBatsmanId as string | undefined,
    };

    await runAction(async () => {
      await api("/api/v1/deliveries", {
        method: "POST",
        body: JSON.stringify({
          inningsId: activeInnings.id,
          overNumber: ball.overNumber,
          ballInOver: ball.ballInOver,
          extrasRuns: 0,
          strikerId,
          nonStrikerId,
          bowlerId,
          ...payload,
        }),
      });
    });

    const [nextStriker, nextNonStriker] = applyStrikeRotationsAfterDelivery(
      strikerId,
      nonStrikerId,
      event,
      { rotateStrikeAfterWicket: ctx.rotateStrikeAfterWicket },
    );
    setStrikerId(nextStriker);
    setNonStrikerId(nextNonStriker);
  }

  function swapEnds() {
    setStrikerId(nonStrikerId);
    setNonStrikerId(strikerId);
  }

  async function recordRuns(runs: number) {
    await postDelivery({ runsOffBat: runs, isLegalBall: true });
  }

  async function recordWide() {
    await postDelivery({
      runsOffBat: 0,
      isLegalBall: false,
      extrasType: "wide",
    });
  }

  async function recordNoBall() {
    await postDelivery({
      runsOffBat: 0,
      isLegalBall: false,
      extrasType: "no_ball",
    });
  }

  async function recordWicket() {
    const dismissed = dismissedId || strikerId;
    await postDelivery({
      runsOffBat: 0,
      isLegalBall: true,
      wicketType,
      dismissedBatsmanId: dismissed,
      fielderId:
        wicketType === "caught" || wicketType === "run_out" || wicketType === "stumped"
          ? fielderId || undefined
          : undefined,
    });
    setWicketOpen(false);
    setFielderId("");
    setDismissedId("");
  }

  async function finalizeMatch() {
    await runAction(async () => {
      await api(`/api/v1/matches/${matchId}/finalize`, { method: "POST" });
    });
  }

  if (!ctx) {
    return (
      <div className="sp-wrap">
        <p className="sp-muted">Loading scorer…</p>
        {error && <p className="sp-error">{error}</p>}
      </div>
    );
  }

  const title = `${ctx.homeTeam.name} vs ${ctx.awayTeam.name}`;

  return (
    <div className="sp-wrap">
      <header className="sp-header">
        <div>
          <h1>{title}</h1>
          {ctx.venue && <p>{ctx.venue}</p>}
        </div>
        <div className="sp-header-links">
          <Link href={`/match/${matchId}`}>Scorecard</Link>
        </div>
      </header>

      {error && <p className="sp-error">{error}</p>}

      {ctx.status === "COMPLETED" && (
        <div className="sp-banner done">
          Match complete —{" "}
          <Link href={`/match/${matchId}`}>view scorecard</Link>
        </div>
      )}

      {ctx.canStartInnings && ctx.status !== "COMPLETED" && (
        <section className="sp-card">
          <h2>Start innings</h2>
          <p>{ctx.canStartInnings.label}</p>
          <p className="sp-muted">
            {ctx.totalOvers} overs · base {ctx.startingScore} · −
            {ctx.wicketPenalty} per wicket
          </p>
          <button
            type="button"
            className="sp-btn primary"
            disabled={busy}
            onClick={startInnings}
          >
            Start {ctx.canStartInnings.inningsNumber === 1 ? "1st" : "2nd"} innings
          </button>
        </section>
      )}

      {ctx.canFinalize && (
        <section className="sp-card">
          <h2>Both innings complete</h2>
          <button
            type="button"
            className="sp-btn primary"
            disabled={busy}
            onClick={finalizeMatch}
          >
            Finalize match
          </button>
        </section>
      )}

      {activeInnings && !activeInnings.complete && (
        <>
          <section className="sp-scoreboard">
            <div>
              <div className="sp-score-label">
                {activeInnings.battingTeamName} · Innings{" "}
                {activeInnings.inningsNumber}
              </div>
              <div className="sp-score-main">
                {activeInnings.totalRuns}
                <span className="sp-score-wkts">-{activeInnings.wickets}</span>
              </div>
              <div className="sp-score-meta">
                Net {activeInnings.netRuns > 0 ? "+" : ""}
                {activeInnings.netRuns} · {activeInnings.batRuns} off bat · Ov{" "}
                {formatOver(activeInnings.nextBall)} / {ctx.totalOvers}
              </div>
            </div>
            <div className="sp-vs">
              vs {activeInnings.bowlingTeamName}
            </div>
          </section>

          <section className="sp-card sp-players">
            <label>
              Striker
              <select
                value={strikerId}
                onChange={(e) => setStrikerId(e.target.value)}
              >
                {battingSquad.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Non-striker
              <select
                value={nonStrikerId}
                onChange={(e) => setNonStrikerId(e.target.value)}
              >
                {battingSquad.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Bowler
              <select
                value={bowlerId}
                onChange={(e) => setBowlerId(e.target.value)}
              >
                {bowlingSquad.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="sp-pad">
            <div className="sp-runs">
              {[0, 1, 2, 3, 4, 6].map((r) => (
                <button
                  key={r}
                  type="button"
                  className="sp-key run"
                  disabled={busy}
                  onClick={() => recordRuns(r)}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="sp-extras">
              <button
                type="button"
                className="sp-key extra"
                disabled={busy}
                onClick={recordWide}
              >
                Wide
              </button>
              <button
                type="button"
                className="sp-key extra"
                disabled={busy}
                onClick={recordNoBall}
              >
                No ball
              </button>
              <button
                type="button"
                className="sp-key wicket"
                disabled={busy}
                onClick={() => {
                  setDismissedId(strikerId);
                  setWicketOpen((v) => !v);
                }}
              >
                Wicket
              </button>
            </div>
          </section>

          {wicketOpen && (
            <section className="sp-card sp-wicket-panel">
              <h3>Wicket</h3>
              <label>
                Type
                <select
                  value={wicketType}
                  onChange={(e) => setWicketType(e.target.value as WicketKind)}
                >
                  <option value="bowled">Bowled</option>
                  <option value="caught">Caught</option>
                  <option value="run_out">Run out</option>
                  <option value="lbw">LBW</option>
                  <option value="stumped">Stumped</option>
                </select>
              </label>
              <label>
                Out
                <select
                  value={dismissedId || strikerId}
                  onChange={(e) => setDismissedId(e.target.value)}
                >
                  {battingSquad.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              {(wicketType === "caught" ||
                wicketType === "run_out" ||
                wicketType === "stumped") && (
                <label>
                  Fielder
                  <select
                    value={fielderId}
                    onChange={(e) => setFielderId(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {bowlingSquad.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                type="button"
                className="sp-btn primary"
                disabled={busy}
                onClick={recordWicket}
              >
                Confirm wicket
              </button>
            </section>
          )}

          {activeInnings.complete && ctx.canStartInnings && (
            <section className="sp-card">
              <p>Innings complete ({ctx.totalOvers} overs).</p>
              <button
                type="button"
                className="sp-btn primary"
                disabled={busy}
                onClick={startInnings}
              >
                {ctx.canStartInnings.label}
              </button>
            </section>
          )}
        </>
      )}

      {!activeInnings && !ctx.canStartInnings && ctx.status !== "COMPLETED" && (
        <section className="sp-card">
          <p className="sp-muted">Waiting to start or resume scoring.</p>
        </section>
      )}

      <section className="sp-card sp-roster">
        <h2>Squads</h2>
        <div className="sp-roster-cols">
          <div>
            <h3>{ctx.homeTeam.name}</h3>
            <ul>
              {ctx.squads.home.map((p) => (
                <li key={p.id}>{p.name}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3>{ctx.awayTeam.name}</h3>
            <ul>
              {ctx.squads.away.map((p) => (
                <li key={p.id}>{p.name}</li>
              ))}
            </ul>
          </div>
        </div>
        <button
          type="button"
          className="sp-btn"
          disabled={busy}
          onClick={saveSquads}
        >
          Save squads to match
        </button>
      </section>
    </div>
  );
}
