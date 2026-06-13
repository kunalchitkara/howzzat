"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client/api";
import { BtnLink, card } from "./ui";

type InviteRow = {
  id: string;
  email: string;
  kind: string;
  role: string;
  token: string;
  acceptedAt: string | null;
  team: { name: string } | null;
};

export function InviteList({
  tournamentId,
  invites,
}: {
  tournamentId: string;
  invites: InviteRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(invites);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(invites);
  }, [invites]);

  if (rows.length === 0) {
    return null;
  }

  async function remove(inviteId: string) {
    setBusyId(inviteId);
    setError(null);
    try {
      await apiFetch(`/api/v1/tournaments/${tournamentId}/invites/${inviteId}`, {
        method: "DELETE",
      });
      setRows((current) => current.filter((inv) => inv.id !== inviteId));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove invite");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      {error && (
        <p style={{ color: "var(--red)", marginBottom: 12, fontSize: "0.9rem" }}>{error}</p>
      )}
      <ul style={{ listStyle: "none", marginBottom: 16 }}>
        {rows.map((inv) => (
          <li key={inv.id} style={card}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              <div>
                <strong>{inv.email}</strong> —{" "}
                {inv.kind === "MANAGER"
                  ? "Tournament manager"
                  : inv.role === "SCORER"
                    ? "Scorer"
                    : inv.role}
                {inv.team ? ` (${inv.team.name})` : ""}
                <p style={{ fontSize: "0.85rem", color: "#666", marginTop: 4 }}>
                  {inv.acceptedAt ? "Accepted" : "Pending"}
                  {" · "}
                  <BtnLink
                    href={`/invite/${inv.token}`}
                    variant="secondary"
                    className="btn-nav"
                  >
                    Invite link
                  </BtnLink>
                </p>
              </div>
              {!inv.acceptedAt && (
                <button
                  type="button"
                  aria-label={`Remove invite for ${inv.email}`}
                  disabled={busyId === inv.id}
                  onClick={() => void remove(inv.id)}
                  className="btn btn-secondary btn-nav"
                  style={{
                    borderRadius: 9999,
                    padding: "0 0.6rem",
                    fontSize: "1.15rem",
                    lineHeight: 1.3,
                    minWidth: 32,
                    flexShrink: 0,
                  }}
                >
                  ×
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
