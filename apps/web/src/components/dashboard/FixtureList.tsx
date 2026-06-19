"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client/api";
import { dateInputValue, formatFixtureDate } from "@/lib/format-date";
import { matchPublicRef } from "@/lib/match-slug";
import { BtnLink, card, input } from "./ui";

type FixtureRow = {
  id: string;
  slug: string | null;
  status: string;
  scheduledAt: string | null;
  venue: string | null;
  marginText: string | null;
  homeTeamName: string;
  awayTeamName: string;
  hasDeliveries: boolean;
};

const binButtonStyle = {
  borderRadius: 9999,
  padding: 0,
  fontSize: "1.15rem",
  lineHeight: 1,
  minWidth: 44,
  minHeight: 44,
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
} as const;

export function FixtureList({ fixtures }: { fixtures: FixtureRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(fixtures);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [draftDate, setDraftDate] = useState("");

  useEffect(() => {
    setRows(fixtures);
  }, [fixtures]);

  async function saveDate(matchId: string, value: string) {
    if (!value) return;
    setBusyId(matchId);
    setError(null);
    try {
      await apiFetch(`/api/v1/matches/${matchId}`, {
        method: "PATCH",
        body: JSON.stringify({
          scheduledAt: new Date(value).toISOString(),
        }),
      });
      setEditingDateId(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update date");
    } finally {
      setBusyId(null);
    }
  }

  async function cancelFixture(fixture: FixtureRow) {
    const message = fixture.hasDeliveries
      ? "This match has scoring data. Cancel it and mark as abandoned?"
      : "Remove this fixture from the schedule?";
    if (!window.confirm(message)) return;

    setBusyId(fixture.id);
    setError(null);
    try {
      await apiFetch(`/api/v1/matches/${fixture.id}`, { method: "DELETE" });
      setRows((current) => current.filter((row) => row.id !== fixture.id));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel fixture");
    } finally {
      setBusyId(null);
    }
  }

  if (rows.length === 0) {
    return null;
  }

  return (
    <>
      {error && (
        <p style={{ color: "var(--red)", marginBottom: 12, fontSize: "0.9rem" }}>
          {error}
        </p>
      )}
      <ul style={{ listStyle: "none", marginBottom: 16 }}>
        {rows.map((fixture) => {
          const canReschedule = fixture.status === "SCHEDULED";
          const canCancel =
            fixture.status !== "COMPLETED" &&
            fixture.status !== "ABANDONED" &&
            fixture.status !== "WALKOVER";
          const busy = busyId === fixture.id;
          const formattedDate = formatFixtureDate(fixture.scheduledAt);
          const editingDate = editingDateId === fixture.id;

          return (
            <li key={fixture.id} style={card}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: "1 1 180px", minWidth: 0 }}>
                  <strong>
                    {fixture.homeTeamName} vs {fixture.awayTeamName}
                  </strong>
                  <p
                    style={{
                      fontSize: "0.85rem",
                      color: "#666",
                      marginTop: 4,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "0.35rem 0.5rem",
                      alignItems: "center",
                    }}
                  >
                    <span>{fixture.status}</span>
                    {formattedDate && !editingDate && (
                      <>
                        <span aria-hidden>·</span>
                        <span>{formattedDate}</span>
                      </>
                    )}
                    {canReschedule && editingDate && (
                      <>
                        <input
                          type="date"
                          value={draftDate}
                          disabled={busy}
                          onChange={(e) => setDraftDate(e.target.value)}
                          style={{ ...input, width: "auto", marginTop: 0 }}
                          aria-label={`New date for ${fixture.homeTeamName} vs ${fixture.awayTeamName}`}
                        />
                        <button
                          type="button"
                          className="btn btn-primary btn-nav"
                          disabled={busy || !draftDate}
                          onClick={() => void saveDate(fixture.id, draftDate)}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-nav"
                          disabled={busy}
                          onClick={() => setEditingDateId(null)}
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    {canReschedule && !editingDate && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-nav"
                        disabled={busy}
                        style={{ padding: "0.25rem 0.65rem", fontSize: "0.8rem" }}
                        onClick={() => {
                          setEditingDateId(fixture.id);
                          setDraftDate(
                            dateInputValue(fixture.scheduledAt) ||
                              dateInputValue(new Date()),
                          );
                        }}
                      >
                        Change date
                      </button>
                    )}
                    {fixture.venue && (
                      <>
                        <span aria-hidden>·</span>
                        <span>{fixture.venue}</span>
                      </>
                    )}
                    {fixture.marginText && (
                      <>
                        <span aria-hidden>·</span>
                        <span>{fixture.marginText}</span>
                      </>
                    )}
                  </p>
                </div>
                <div
                  className="btn-group"
                  style={{ justifyContent: "flex-end", gap: 8, flexShrink: 0 }}
                >
                  {canCancel && (
                    <button
                      type="button"
                      aria-label="Cancel fixture"
                      disabled={busy}
                      onClick={() => void cancelFixture(fixture)}
                      className="btn btn-secondary btn-nav"
                      style={binButtonStyle}
                    >
                      🗑
                    </button>
                  )}
                  <BtnLink
                    href={`/match/${matchPublicRef(fixture)}`}
                    variant="secondary"
                    className="btn-nav"
                  >
                    Scorecard
                  </BtnLink>
                  <BtnLink
                    href={`/match/${matchPublicRef(fixture)}/score`}
                    className="btn-nav"
                  >
                    Score
                  </BtnLink>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
