"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { applyStrikeRotationsAfterDelivery } from "@howzzat/rules-engine";
import type { DeliveryEvent } from "@howzzat/rules-engine";
import type { MatchScoringContext, ScoringPlayer } from "@/lib/scoring/types";
import { formatBallLabel } from "@/lib/scoring/ball-label";
import "./scorepad.css";

type WicketKind = "bowled" | "caught" | "run_out" | "lbw" | "stumped";
type ExtrasPanel = "wide" | "no_ball" | "bye" | "leg_bye" | null;

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

  const [extrasOpen, setExtrasOpen] = useState<ExtrasPanel>(null);
  const [wicketOpen, setWicketOpen] = useState(false);
  const [wicketType, setWicketType] = useState<WicketKind>("bowled");
  const [fielderId, setFielderId] = useState("");
  const [dismissedId, setDismissedId] = useState("");
  const [draftHomeIds, setDraftHomeIds] = useState<string[]>([]);
  const [draftAwayIds, setDraftAwayIds] = useState<string[]>([]);
  const [draftHomeCaptainId, setDraftHomeCaptainId] = useState("");
  const [draftAwayCaptainId, setDraftAwayCaptainId] = useState("");

  const syncDraftFromServer = useCallback((data: MatchScoringContext) => {
    setDraftHomeIds(data.squads.home.map((p) => p.id));
    setDraftAwayIds(data.squads.away.map((p) => p.id));
    setDraftHomeCaptainId(data.squads.home.find((p) => p.isCaptain)?.id ?? "");
    setDraftAwayCaptainId(data.squads.away.find((p) => p.isCaptain)?.id ?? "");
  }, []);

  const refresh = useCallback(async () => {
    const data = await api<MatchScoringContext>(
      `/api/v1/matches/${matchId}/scoring`,
    );
    setCtx(data);
    return data;
  }, [matchId]);

  useEffect(() => {
    refresh()
      .then(syncDraftFromServer)
      .catch((e) => setError(String(e.message ?? e)));
  }, [refresh, syncDraftFromServer]);

  function playersForSide(side: "home" | "away"): ScoringPlayer[] {
    if (!ctx) return [];
    const roster = ctx.rosters[side];
    const ids = side === "home" ? draftHomeIds : draftAwayIds;
    return ids
      .map((id) => roster.find((p) => p.id === id))
      .filter((p): p is ScoringPlayer => Boolean(p));
  }

  const activeInnings = useMemo(
    () => ctx?.innings.find((i) => i.id === ctx.activeInningsId) ?? null,
    [ctx],
  );

  const battingSquad = useMemo(() => {
    if (!ctx || !activeInnings) return [];
    const playing =
      activeInnings.battingTeamId === ctx.homeTeam.id
        ? playersForSide("home")
        : playersForSide("away");
    if (playing.length > 0) return playing;
    return activeInnings.battingTeamId === ctx.homeTeam.id
      ? ctx.rosters.home
      : ctx.rosters.away;
  }, [ctx, activeInnings, draftHomeIds, draftAwayIds]);

  const bowlingSquad = useMemo(() => {
    if (!ctx || !activeInnings) return [];
    const playing =
      activeInnings.battingTeamId === ctx.homeTeam.id
        ? playersForSide("away")
        : playersForSide("home");
    if (playing.length > 0) return playing;
    return activeInnings.battingTeamId === ctx.homeTeam.id
      ? ctx.rosters.away
      : ctx.rosters.home;
  }, [ctx, activeInnings, draftHomeIds, draftAwayIds]);

  useEffect(() => {
    if (!battingSquad.length || strikerId) return;
    setStrikerId(battingSquad[0]?.id ?? "");
    setNonStrikerId(battingSquad[1]?.id ?? battingSquad[0]?.id ?? "");
  }, [battingSquad, strikerId]);

  useEffect(() => {
    if (!bowlingSquad.length || bowlerId) return;
    setBowlerId(bowlingSquad[0]?.id ?? "");
  }, [bowlingSquad, bowlerId]);

  useEffect(() => {
    if (!activeInnings?.bowlerLocked || !activeInnings.lockedBowlerId) return;
    setBowlerId(activeInnings.lockedBowlerId);
  }, [
    activeInnings?.bowlerLocked,
    activeInnings?.lockedBowlerId,
    activeInnings?.nextBall.overNumber,
  ]);

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
    setBusy(true);
    setError(null);
    try {
      await api(`/api/v1/matches/${matchId}/squad`, {
        method: "POST",
        body: JSON.stringify({
          teamId: ctx.homeTeam.teamId,
          playerIds: draftHomeIds,
          captainId: draftHomeCaptainId || undefined,
        }),
      });
      await api(`/api/v1/matches/${matchId}/squad`, {
        method: "POST",
        body: JSON.stringify({
          teamId: ctx.awayTeam.teamId,
          playerIds: draftAwayIds,
          captainId: draftAwayCaptainId || undefined,
        }),
      });
      const data = await refresh();
      syncDraftFromServer(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function addToSquad(side: "home" | "away", playerId: string) {
    if (side === "home") {
      setDraftHomeIds((ids) => (ids.includes(playerId) ? ids : [...ids, playerId]));
    } else {
      setDraftAwayIds((ids) => (ids.includes(playerId) ? ids : [...ids, playerId]));
    }
  }

  function setCaptain(side: "home" | "away", playerId: string) {
    if (side === "home") {
      setDraftHomeCaptainId((current) => (current === playerId ? "" : playerId));
    } else {
      setDraftAwayCaptainId((current) => (current === playerId ? "" : playerId));
    }
  }

  function removeFromSquad(side: "home" | "away", playerId: string) {
    if (side === "home") {
      setDraftHomeIds((ids) => ids.filter((id) => id !== playerId));
      if (draftHomeCaptainId === playerId) setDraftHomeCaptainId("");
    } else {
      setDraftAwayIds((ids) => ids.filter((id) => id !== playerId));
      if (draftAwayCaptainId === playerId) setDraftAwayCaptainId("");
    }
    if (strikerId === playerId || nonStrikerId === playerId || bowlerId === playerId) {
      setStrikerId("");
      setNonStrikerId("");
      setBowlerId("");
    }
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
      extrasRunsType: payload.extrasRunsType as DeliveryEvent["extrasRunsType"],
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
    setExtrasOpen(null);
  }

  async function recordExtra(payload: Record<string, unknown>) {
    await postDelivery(payload);
  }

  function swapEnds() {
    setStrikerId(nonStrikerId);
    setNonStrikerId(strikerId);
  }

  function pickStriker(id: string) {
    if (id === nonStrikerId) swapEnds();
    else setStrikerId(id);
  }

  function pickNonStriker(id: string) {
    if (id === strikerId) swapEnds();
    else setNonStrikerId(id);
  }

  async function recordRuns(runs: number) {
    await postDelivery({ runsOffBat: runs, isLegalBall: true });
  }

  async function recordWicket() {
    const dismissed = dismissedId || strikerId;
    if (
      (wicketType === "caught" || wicketType === "run_out" || wicketType === "stumped") &&
      !fielderId
    ) {
      setError("Select a fielder for this dismissal");
      return;
    }
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
                Net                 {activeInnings.netRuns > 0 ? "+" : ""}
                {activeInnings.netRuns} · {activeInnings.batRuns} off bat · Ball{" "}
                {formatBallLabel(
                  activeInnings.nextBall.overNumber,
                  activeInnings.nextBall.ballInOver,
                )}{" "}
                / {ctx.totalOvers} ov
              </div>
            </div>
            <div className="sp-vs">
              vs {activeInnings.bowlingTeamName}
            </div>
          </section>

          <section className="sp-card sp-players">
            <div className="sp-players-head">
              <h3>On the field</h3>
              <button
                type="button"
                className="sp-btn sp-swap"
                disabled={busy}
                onClick={swapEnds}
              >
                Swap strike
              </button>
            </div>
            <p className="sp-players-hint">Batsmen can swap ends anytime.</p>
            <label>
              Striker <span className="sp-on-strike">on strike</span>
              <select
                className="sp-striker"
                value={strikerId}
                disabled={busy}
                onChange={(e) => pickStriker(e.target.value)}
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
                disabled={busy}
                onChange={(e) => pickNonStriker(e.target.value)}
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
              {activeInnings.bowlerLocked ? (
                <span className="sp-bowler-locked">
                  locked for over {activeInnings.nextBall.overNumber}
                </span>
              ) : (
                <span className="sp-bowler-pick">pick before 1st ball of over</span>
              )}
              <select
                className="sp-bowler"
                value={bowlerId}
                disabled={busy || activeInnings.bowlerLocked}
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
            <p className="sp-pad-label">Off the bat</p>
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
                className={`sp-key extra${extrasOpen === "wide" ? " active" : ""}`}
                disabled={busy}
                onClick={() => setExtrasOpen((v) => (v === "wide" ? null : "wide"))}
              >
                Wide
              </button>
              <button
                type="button"
                className={`sp-key extra${extrasOpen === "no_ball" ? " active" : ""}`}
                disabled={busy}
                onClick={() => setExtrasOpen((v) => (v === "no_ball" ? null : "no_ball"))}
              >
                No ball
              </button>
              <button
                type="button"
                className={`sp-key extra${extrasOpen === "bye" ? " active" : ""}`}
                disabled={busy}
                onClick={() => setExtrasOpen((v) => (v === "bye" ? null : "bye"))}
              >
                Bye
              </button>
              <button
                type="button"
                className={`sp-key extra${extrasOpen === "leg_bye" ? " active" : ""}`}
                disabled={busy}
                onClick={() => setExtrasOpen((v) => (v === "leg_bye" ? null : "leg_bye"))}
              >
                Leg bye
              </button>
              <button
                type="button"
                className="sp-key wicket"
                disabled={busy}
                onClick={() => {
                  setExtrasOpen(null);
                  setDismissedId(strikerId);
                  setWicketOpen((v) => !v);
                }}
              >
                Wicket
              </button>
            </div>
          </section>

          {extrasOpen === "wide" && (
            <section className="sp-card sp-extras-panel">
              <h3>Wide</h3>
              <p className="sp-muted">Ball missed the bat — add wide penalty and any runs run.</p>
              <button
                type="button"
                className="sp-btn"
                disabled={busy}
                onClick={() =>
                  recordExtra({ runsOffBat: 0, isLegalBall: false, extrasType: "wide", extrasRuns: 0 })
                }
              >
                Wd only
              </button>
              <p className="sp-roster-sub">Wide + runs (no bat)</p>
              <div className="sp-extras-runs">
                {[1, 2, 3, 4].map((r) => (
                  <button
                    key={r}
                    type="button"
                    className="sp-key run"
                    disabled={busy}
                    onClick={() =>
                      recordExtra({
                        runsOffBat: 0,
                        isLegalBall: false,
                        extrasType: "wide_runs",
                        extrasRuns: r,
                      })
                    }
                  >
                    Wd+{r}
                  </button>
                ))}
              </div>
            </section>
          )}

          {extrasOpen === "no_ball" && (
            <section className="sp-card sp-extras-panel">
              <h3>No ball</h3>
              <button
                type="button"
                className="sp-btn"
                disabled={busy}
                onClick={() =>
                  recordExtra({ runsOffBat: 0, isLegalBall: false, extrasType: "no_ball", extrasRuns: 0 })
                }
              >
                Nb only
              </button>
              <p className="sp-roster-sub">Nb + off the bat (ball touched bat)</p>
              <div className="sp-extras-runs">
                {[0, 1, 2, 3, 4, 6].map((r) => (
                  <button
                    key={r}
                    type="button"
                    className="sp-key run"
                    disabled={busy}
                    onClick={() =>
                      recordExtra({
                        runsOffBat: r,
                        isLegalBall: false,
                        extrasType: "no_ball",
                        extrasRuns: 0,
                      })
                    }
                  >
                    Nb+{r}
                  </button>
                ))}
              </div>
              <p className="sp-roster-sub">Nb + runs without bat</p>
              <div className="sp-extras-runs">
                {[1, 2, 3, 4].map((r) => (
                  <button
                    key={r}
                    type="button"
                    className="sp-key run"
                    disabled={busy}
                    onClick={() =>
                      recordExtra({
                        runsOffBat: 0,
                        isLegalBall: false,
                        extrasType: "no_ball_runs",
                        extrasRuns: r,
                        extrasRunsType: "bye",
                      })
                    }
                  >
                    Nb+{r}b
                  </button>
                ))}
              </div>
              <div className="sp-extras-runs">
                {[1, 2, 3, 4].map((r) => (
                  <button
                    key={r}
                    type="button"
                    className="sp-key run"
                    disabled={busy}
                    onClick={() =>
                      recordExtra({
                        runsOffBat: 0,
                        isLegalBall: false,
                        extrasType: "no_ball_runs",
                        extrasRuns: r,
                        extrasRunsType: "leg_bye",
                      })
                    }
                  >
                    Nb+{r}lb
                  </button>
                ))}
              </div>
            </section>
          )}

          {(extrasOpen === "bye" || extrasOpen === "leg_bye") && (
            <section className="sp-card sp-extras-panel">
              <h3>{extrasOpen === "bye" ? "Byes" : "Leg byes"}</h3>
              <p className="sp-muted">
                Legal delivery — ball missed the bat
                {extrasOpen === "leg_bye" ? " but hit the batter's body" : ""}.
              </p>
              <div className="sp-extras-runs">
                {[1, 2, 3, 4].map((r) => (
                  <button
                    key={r}
                    type="button"
                    className="sp-key run"
                    disabled={busy}
                    onClick={() =>
                      recordExtra({
                        runsOffBat: 0,
                        isLegalBall: true,
                        extrasType: extrasOpen,
                        extrasRuns: r,
                      })
                    }
                  >
                    {r}
                  </button>
                ))}
              </div>
            </section>
          )}

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
        <h2>Match squads</h2>
        {ctx.tournamentAgeGroup && (
          <p className="sp-muted">
            {ctx.tournamentAgeGroup} tournament — players above age band shown in{" "}
            <span className="sp-over-age">red</span> (add DOB on team roster if missing).
          </p>
        )}
        <div className="sp-roster-cols">
          {(["home", "away"] as const).map((side) => {
            const teamName = side === "home" ? ctx.homeTeam.name : ctx.awayTeam.name;
            const roster = ctx.rosters[side];
            const selectedIds = side === "home" ? draftHomeIds : draftAwayIds;
            const captainId = side === "home" ? draftHomeCaptainId : draftAwayCaptainId;
            const selected = playersForSide(side);
            const available = roster.filter((p) => !selectedIds.includes(p.id));
            return (
              <div key={side}>
                <h3>{teamName}</h3>
                <p className="sp-roster-sub">Playing today ({selected.length})</p>
                <ul className="sp-roster-list">
                  {selected.length === 0 && (
                    <li className="sp-muted">No players selected — add from roster below</li>
                  )}
                  {selected.map((p) => (
                    <li key={p.id} className={p.overAge ? "sp-over-age" : undefined}>
                      <span>
                        {p.name}
                        {captainId === p.id && (
                          <span className="sp-captain-mark"> (c)</span>
                        )}
                        {p.ageOnMatchDay != null && (
                          <span className="sp-age"> · age {p.ageOnMatchDay}</span>
                        )}
                      </span>
                      <span className="sp-roster-actions">
                        <button
                          type="button"
                          className={
                            captainId === p.id
                              ? "sp-roster-btn captain on"
                              : "sp-roster-btn captain"
                          }
                          disabled={busy}
                          onClick={() => setCaptain(side, p.id)}
                          aria-label={
                            captainId === p.id
                              ? `Remove captain ${p.name}`
                              : `Mark ${p.name} as captain`
                          }
                          title={captainId === p.id ? "Captain" : "Mark as captain"}
                        >
                          c
                        </button>
                        <button
                          type="button"
                          className="sp-roster-btn remove"
                          disabled={busy}
                          onClick={() => removeFromSquad(side, p.id)}
                          aria-label={`Remove ${p.name}`}
                        >
                          −
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="sp-roster-sub">Club roster ({available.length} available)</p>
                <ul className="sp-roster-list">
                  {available.length === 0 && (
                    <li className="sp-muted">All roster players selected</li>
                  )}
                  {available.map((p) => (
                    <li key={p.id} className={p.overAge ? "sp-over-age" : undefined}>
                      <span>
                        {p.name}
                        {p.ageOnMatchDay != null && (
                          <span className="sp-age"> · age {p.ageOnMatchDay}</span>
                        )}
                        {!p.dateOfBirth && (
                          <span className="sp-age"> · no DOB</span>
                        )}
                      </span>
                      <button
                        type="button"
                        className="sp-roster-btn add"
                        disabled={busy}
                        onClick={() => addToSquad(side, p.id)}
                        aria-label={`Add ${p.name}`}
                      >
                        +
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          className="sp-btn primary"
          disabled={busy}
          onClick={saveSquads}
        >
          Save squads to match
        </button>
      </section>
    </div>
  );
}
