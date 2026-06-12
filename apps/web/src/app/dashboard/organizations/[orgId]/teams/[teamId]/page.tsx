import { notFound } from "next/navigation";
import { AddPlayerForm, EditTeamForm } from "@/components/dashboard/forms";
import { PlayerList } from "@/components/dashboard/PlayerList";
import { BtnLink, PageShell } from "@/components/dashboard/ui";
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
        <BtnLink
          href={`/dashboard/organizations/${orgId}/teams`}
          variant="secondary"
          className="btn-nav"
        >
          ← Teams
        </BtnLink>
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
      <ul style={{ listStyle: "none", marginBottom: 24, padding: 0 }}>
        <PlayerList
          teamId={teamId}
          memberships={team.memberships.map((m) => ({
            id: m.id,
            shirtNumber: m.shirtNumber,
            player: {
              id: m.player.id,
              legalName: m.player.legalName,
              displayName: m.player.displayName,
              dateOfBirth: m.player.dateOfBirth?.toISOString() ?? null,
            },
          }))}
        />
      </ul>

      <h2 style={{ color: "var(--dk)", marginBottom: 12, fontSize: "1.1rem" }}>
        Add player
      </h2>
      <AddPlayerForm teamId={teamId} />
    </PageShell>
  );
}
