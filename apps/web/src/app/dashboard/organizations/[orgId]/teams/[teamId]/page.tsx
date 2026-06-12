import Link from "next/link";
import { notFound } from "next/navigation";
import { AddPlayerForm, EditTeamForm } from "@/components/dashboard/forms";
import { PageShell, card } from "@/components/dashboard/ui";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ orgId: string; teamId: string }>;
}) {
  const { orgId, teamId } = await params;
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      organization: true,
      memberships: {
        where: { active: true },
        include: { player: true },
        orderBy: { shirtNumber: "asc" },
      },
    },
  });
  if (!team || team.organizationId !== orgId) notFound();

  return (
    <PageShell title={team.name} subtitle={`${team.organization.name} roster`}>
      <p style={{ marginBottom: 16 }}>
        <Link href={`/dashboard/organizations/${orgId}/teams`}>← Teams</Link>
      </p>

      <h2 style={{ color: "var(--dk)", marginBottom: 12, fontSize: "1.1rem" }}>
        Team details
      </h2>
      <EditTeamForm
        orgId={orgId}
        teamId={teamId}
        initialName={team.name}
        initialAgeGroup={team.ageGroup}
      />

      <h2
        style={{
          color: "var(--dk)",
          marginBottom: 12,
          marginTop: 28,
          fontSize: "1.1rem",
        }}
      >
        Players ({team.memberships.length})
      </h2>
      <ul style={{ listStyle: "none", marginBottom: 24 }}>
        {team.memberships.length === 0 ? (
          <li style={{ ...card, color: "#666" }}>No players yet — add your squad below.</li>
        ) : (
          team.memberships.map((m) => (
            <li key={m.player.id} style={card}>
              {m.shirtNumber != null && (
                <span style={{ fontWeight: 700, marginRight: 8, color: "var(--md)" }}>
                  #{m.shirtNumber}
                </span>
              )}
              {m.player.displayName ?? m.player.legalName}
              {m.player.dateOfBirth && (
                <span style={{ color: "#666", fontSize: "0.85rem", marginLeft: 8 }}>
                  DOB {m.player.dateOfBirth.toISOString().slice(0, 10)}
                </span>
              )}
            </li>
          ))
        )}
      </ul>

      <h2 style={{ color: "var(--dk)", marginBottom: 12, fontSize: "1.1rem" }}>
        Add player
      </h2>
      <AddPlayerForm teamId={teamId} />
    </PageShell>
  );
}
