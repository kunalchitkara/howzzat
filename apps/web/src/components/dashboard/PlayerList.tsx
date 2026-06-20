"use client";

import { useState } from "react";
import { formatPlayerAge } from "@/lib/scoring/age-eligibility";
import { EditPlayerForm } from "./forms";
import { card } from "./ui";

type PlayerMembership = {
  id: string;
  shirtNumber: number | null;
  player: {
    id: string;
    legalName: string;
    displayName: string | null;
    dateOfBirth: string | null;
  };
};

export function PlayerList({
  teamId,
  memberships,
  canEdit = true,
}: {
  teamId: string;
  memberships: PlayerMembership[];
  canEdit?: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (memberships.length === 0) {
    return (
      <li style={{ ...card, color: "#666", listStyle: "none" }}>
        {canEdit ? "No players yet — add your squad below." : "No players on this squad."}
      </li>
    );
  }

  return (
    <>
      {memberships.map((m) => {
        const ageLabel = m.player.dateOfBirth
          ? formatPlayerAge(new Date(m.player.dateOfBirth))
          : null;
        const selected = canEdit && selectedId === m.player.id;

        return (
          <li key={m.player.id} style={{ listStyle: "none", marginBottom: selected ? 0 : 8 }}>
            {canEdit ? (
              <button
                type="button"
                onClick={() => setSelectedId(selected ? null : m.player.id)}
                style={{
                  ...card,
                  width: "100%",
                  textAlign: "left",
                  cursor: "pointer",
                  border: selected ? "2px solid var(--md)" : "2px solid transparent",
                  marginBottom: selected ? 0 : undefined,
                }}
              >
                {m.shirtNumber != null && (
                  <span style={{ fontWeight: 700, marginRight: 8, color: "var(--md)" }}>
                    #{m.shirtNumber}
                  </span>
                )}
                {m.player.displayName ?? m.player.legalName}
                {ageLabel && (
                  <span style={{ color: "#666", fontSize: "0.85rem", marginLeft: 8 }}>
                    {ageLabel}
                  </span>
                )}
                <span style={{ float: "right", color: "#999", fontSize: "0.8rem" }}>
                  {selected ? "▲" : "Edit"}
                </span>
              </button>
            ) : (
              <div style={card}>
                {m.shirtNumber != null && (
                  <span style={{ fontWeight: 700, marginRight: 8, color: "var(--md)" }}>
                    #{m.shirtNumber}
                  </span>
                )}
                {m.player.displayName ?? m.player.legalName}
                {ageLabel && (
                  <span style={{ color: "#666", fontSize: "0.85rem", marginLeft: 8 }}>
                    {ageLabel}
                  </span>
                )}
              </div>
            )}
            {selected && (
              <EditPlayerForm
                teamId={teamId}
                playerId={m.player.id}
                initialLegalName={m.player.legalName}
                initialDisplayName={m.player.displayName}
                initialDateOfBirth={m.player.dateOfBirth?.slice(0, 10) ?? ""}
                initialShirtNumber={m.shirtNumber}
                onDone={() => setSelectedId(null)}
              />
            )}
          </li>
        );
      })}
    </>
  );
}
