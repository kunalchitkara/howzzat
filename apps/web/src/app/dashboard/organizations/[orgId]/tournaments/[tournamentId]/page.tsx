import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AddTournamentTeamForm,
  CreateMatchForm,
  InviteForm,
} from "@/components/dashboard/forms";
import { TournamentBalanceSummary } from "@/components/dashboard/TournamentBalanceSummary";
import { PageShell, card } from "@/components/dashboard/ui";
import { getTournament } from "@/lib/services/tournaments";
import { getOrganization } from "@/lib/services/organizations";
import { listInvites } from "@/lib/services/invites";
import { ApiError } from "@/lib/api/http";

export const dynamic = "force-dynamic";

export default async function TournamentDashboardPage({
  params,
}: {
  params: Promise<{ orgId: string; tournamentId: string }>;
}) {
  const { orgId, tournamentId } = await params;
  let tournament;
  let org;
  try {
    [tournament, org] = await Promise.all([
      getTournament(tournamentId),
      getOrganization(orgId),
    ]);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  if (tournament.organizationId !== orgId) notFound();

  const invites = await listInvites(tournamentId);
  const orgTeams = org.teams.map((t) => ({ id: t.id, name: t.name }));
  const tournamentTeams = tournament.teams.map((tt) => ({
    id: tt.id,
    name: tt.team.name,
  }));

  return (
    <PageShell
      title={tournament.name}
      subtitle={`${org.name} · ${tournament.ageGroup ?? ""} ${tournament.seasonLabel ?? ""}`.trim()}
    >
      <p style={{ marginBottom: 16 }}>
        <Link href={`/dashboard/organizations/${orgId}/tournaments`}>
          ← Tournaments
        </Link>
        {tournament.isPublic && (
          <>
            {" · "}
            <Link href={`/orgs/${org.slug}/tournaments/${tournament.slug}`}>
              Public page
            </Link>
          </>
        )}
      </p>

      <TournamentBalanceSummary
        orgId={orgId}
        tournamentId={tournamentId}
        balancePence={tournament.balancePence}
      />

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ color: "var(--dk)", marginBottom: 12, fontSize: "1.1rem" }}>
          Fixtures ({tournament.matches.length})
        </h2>
        <ul style={{ listStyle: "none", marginBottom: 16 }}>
          {tournament.matches.map((m) => (
            <li key={m.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <strong>
                    {m.homeTeam.team.name} vs {m.awayTeam.team.name}
                  </strong>
                  <p style={{ fontSize: "0.85rem", color: "#666", marginTop: 4 }}>
                    {m.status}
                    {m.venue ? ` · ${m.venue}` : ""}
                    {m.marginText ? ` · ${m.marginText}` : ""}
                  </p>
                </div>
                <div style={{ textAlign: "right", fontSize: "0.85rem" }}>
                  <Link href={`/match/${m.id}`}>Scorecard</Link>
                  {" · "}
                  <Link href={`/match/${m.id}/score`}>Score</Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <CreateMatchForm tournamentId={tournamentId} tournamentTeams={tournamentTeams} />
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ color: "var(--dk)", marginBottom: 12, fontSize: "1.1rem" }}>
          Teams in tournament ({tournamentTeams.length})
        </h2>
        <ul style={{ listStyle: "none", marginBottom: 16 }}>
          {tournamentTeams.map((t) => (
            <li key={t.id} style={card}>
              {t.name}
            </li>
          ))}
        </ul>
        <AddTournamentTeamForm tournamentId={tournamentId} teams={orgTeams} />
      </section>

      <section>
        <h2 style={{ color: "var(--dk)", marginBottom: 12, fontSize: "1.1rem" }}>
          Coach invites
        </h2>
        {invites.length > 0 && (
          <ul style={{ listStyle: "none", marginBottom: 16 }}>
            {invites.map((inv) => (
              <li key={inv.id} style={card}>
                <strong>{inv.email}</strong> — {inv.role}
                {inv.team ? ` (${inv.team.name})` : ""}
                <p style={{ fontSize: "0.85rem", color: "#666", marginTop: 4 }}>
                  {inv.acceptedAt ? "Accepted" : "Pending"} ·{" "}
                  <Link href={`/invite/${inv.token}`}>Invite link</Link>
                </p>
              </li>
            ))}
          </ul>
        )}
        <InviteForm tournamentId={tournamentId} teams={orgTeams} />
      </section>
    </PageShell>
  );
}
