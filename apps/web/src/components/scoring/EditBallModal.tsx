"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ScoringDeliveryView, ScoringPlayer } from "@/lib/scoring/types";
import { formatBallLabel } from "@/lib/scoring/ball-label";

type WicketKind = "bowled" | "caught" | "run_out" | "lbw" | "stumped";
type EditKind = "runs" | "wide" | "no_ball" | "bye" | "leg_bye" | "wicket";

export type DeliveryPatch = {
  runsOffBat: number;
  isLegalBall: boolean;
  extrasType: string | null;
  extrasRuns: number;
  extrasRunsType: string | null;
  wicketType: string | null;
  fielderId: string | null;
  dismissedBatsmanId: string | null;
};

function inferKind(d: ScoringDeliveryView): EditKind {
  if (d.wicketType) return "wicket";
  if (d.extrasType === "wide" || d.extrasType === "wide_runs") return "wide";
  if (d.extrasType === "no_ball" || d.extrasType === "no_ball_runs") return "no_ball";
  if (d.extrasType === "bye") return "bye";
  if (d.extrasType === "leg_bye") return "leg_bye";
  return "runs";
}

function buildPatch(
  kind: EditKind,
  runs: number,
  wicketType: WicketKind,
  fielderId: string,
  dismissedId: string,
): DeliveryPatch {
  if (kind === "wicket") {
    return {
      runsOffBat: 0,
      isLegalBall: true,
      extrasType: null,
      extrasRuns: 0,
      extrasRunsType: null,
      wicketType,
      fielderId:
        wicketType === "caught" || wicketType === "run_out" || wicketType === "stumped"
          ? fielderId || null
          : null,
      dismissedBatsmanId: dismissedId || null,
    };
  }
  if (kind === "wide") {
    return {
      runsOffBat: 0,
      isLegalBall: false,
      extrasType: runs > 0 ? "wide_runs" : "wide",
      extrasRuns: runs,
      extrasRunsType: null,
      wicketType: null,
      fielderId: null,
      dismissedBatsmanId: null,
    };
  }
  if (kind === "no_ball") {
    return {
      runsOffBat: runs,
      isLegalBall: false,
      extrasType: "no_ball",
      extrasRuns: 0,
      extrasRunsType: null,
      wicketType: null,
      fielderId: null,
      dismissedBatsmanId: null,
    };
  }
  if (kind === "bye") {
    return {
      runsOffBat: 0,
      isLegalBall: true,
      extrasType: "bye",
      extrasRuns: runs,
      extrasRunsType: null,
      wicketType: null,
      fielderId: null,
      dismissedBatsmanId: null,
    };
  }
  if (kind === "leg_bye") {
    return {
      runsOffBat: 0,
      isLegalBall: true,
      extrasType: "leg_bye",
      extrasRuns: runs,
      extrasRunsType: null,
      wicketType: null,
      fielderId: null,
      dismissedBatsmanId: null,
    };
  }
  return {
    runsOffBat: runs,
    isLegalBall: true,
    extrasType: null,
    extrasRuns: 0,
    extrasRunsType: null,
    wicketType: null,
    fielderId: null,
    dismissedBatsmanId: null,
  };
}

export function EditBallModal({
  delivery,
  battingSquad,
  bowlingSquad,
  busy,
  onClose,
  onSave,
}: {
  delivery: ScoringDeliveryView;
  battingSquad: ScoringPlayer[];
  bowlingSquad: ScoringPlayer[];
  busy: boolean;
  onClose: () => void;
  onSave: (patch: DeliveryPatch) => Promise<void>;
}) {
  const [kind, setKind] = useState<EditKind>(() => inferKind(delivery));
  const [runs, setRuns] = useState(() => {
    if (delivery.wicketType) return 0;
    if (delivery.extrasType === "wide" || delivery.extrasType === "wide_runs") {
      return delivery.extrasRuns;
    }
    if (delivery.extrasType === "bye" || delivery.extrasType === "leg_bye") {
      return delivery.extrasRuns;
    }
    return delivery.runsOffBat;
  });
  const [wicketType, setWicketType] = useState<WicketKind>(
    (delivery.wicketType as WicketKind) ?? "bowled",
  );
  const [fielderId, setFielderId] = useState(delivery.fielderId ?? "");
  const [dismissedId, setDismissedId] = useState(
    delivery.dismissedBatsmanId ?? delivery.strikerId,
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  async function handleSave() {
    setLocalError(null);
    if (
      kind === "wicket" &&
      (wicketType === "caught" || wicketType === "run_out" || wicketType === "stumped") &&
      !fielderId
    ) {
      setLocalError("Select a fielder for this dismissal");
      return;
    }
    await onSave(buildPatch(kind, runs, wicketType, fielderId, dismissedId));
  }

  const runsLabel =
    kind === "runs"
      ? "Runs off the bat"
      : kind === "wide"
        ? "Wide + extra runs (no bat)"
        : kind === "no_ball"
          ? "No ball + runs off bat"
          : kind === "bye"
            ? "Byes"
            : "Leg byes";

  const modal = (
    <div className="sp-edit-ball-backdrop" role="presentation" onClick={onClose}>
      <section
        className="sp-card sp-edit-ball"
        role="dialog"
        aria-labelledby="sp-edit-ball-title"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <h3 id="sp-edit-ball-title">
          Edit ball {formatBallLabel(delivery.overNumber, delivery.ballInOver)}
        </h3>
        <p className="sp-muted">
          Was: <strong>{delivery.symbol}</strong> — fix the score, then continue.
        </p>

        <div className="sp-edit-kinds">
          {(
            [
              ["runs", "Off bat"],
              ["wide", "Wide"],
              ["no_ball", "No ball"],
              ["bye", "Bye"],
              ["leg_bye", "Leg bye"],
              ["wicket", "Wicket"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={`sp-key extra${kind === k ? " active" : ""}`}
              disabled={busy}
              onClick={() => setKind(k)}
            >
              {label}
            </button>
          ))}
        </div>

        {kind === "wicket" ? (
          <>
            <label>
              Dismissal
              <select
                value={wicketType}
                disabled={busy}
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
              Batter out
              <select
                value={dismissedId}
                disabled={busy}
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
                  disabled={busy}
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
          </>
        ) : (
          <div className="sp-edit-runs">
            <p className="sp-edit-runs-label">{runsLabel}</p>
            <div className="sp-runs" role="group" aria-label={runsLabel}>
              {(kind === "runs" ? [0, 1, 2, 3, 4, 6] : [0, 1, 2, 3, 4]).map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`sp-key run${runs === r ? " active" : ""}`}
                  disabled={busy}
                  aria-pressed={runs === r}
                  onClick={() => setRuns(r)}
                >
                  {kind === "runs" && r === 0 ? "·" : r}
                </button>
              ))}
            </div>
          </div>
        )}

        {localError && <p className="sp-error">{localError}</p>}

        <div className="sp-edit-actions">
          <button type="button" className="sp-btn" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="sp-btn primary" disabled={busy} onClick={handleSave}>
            Save &amp; resume
          </button>
        </div>
      </section>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modal, document.body);
}
