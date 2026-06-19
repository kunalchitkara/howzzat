import { notFound } from "next/navigation";
import {
  AddTournamentTeamForm,
  CreateMatchForm,
  InviteForm,
} from "@/components/dashboard/forms";
import { InviteList } from "@/components/dashboard/InviteList";
import { TournamentBalanceSummary } from "@/components/dashboard/TournamentBalanceSummary";
import { BtnLink, PageShell, card } from "@/components/dashboard/ui";
import { matchPublicRef } from "@/lib/match-slug";
import { getTournament, isExternalTeam } from "@/lib/services/tournaments";
import { getTournamentInsights } from "@/lib/services/tournament-insights";
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
  const clubTournamentTeamIds = tournament.teams
    .filter((tt) => !isExternalTeam(tt.team))
    .filter((tt) => org.teams.some((ot) => ot.id === tt.teamId))
    .map((tt) => tt.id);
  let insights;
  try {
    insights = await getTournamentInsights(tournamentId, {
      focusTeamIds: clubTournamentTeamIds.length ? clubTournamentTeamIds : undefined,
    });
  } catch {
    insights = null;
  }
  const enrolledTeamIds = new Set(tournament.teams.map((tt) => tt.teamId));
  const orgTeams = org.teams.map((t) => ({ id: t.id, name: t.name }));
  const availableOrgTeams = org.teams
    .filter((t) => !enrolledTeamIds.has(t.id))
    .map((t) => ({ id: t.id, name: t.name }));
  const tournamentTeams = tournament.teams.map((tt) => ({
    id: tt.id,
    name: tt.team.name,
  }));

  return (
    <PageShell
      title={tournament.name}
      subtitle={`${org.name} · ${tournament.ageGroup ?? ""} ${tournament.seasonLabel ?? ""}`.trim()}
    >
      <div className="btn-group" style={{ marginBottom: 16 }}>
        <BtnLink
          href={`/dashboard/organizations/${orgId}/tournaments`}
          variant="secondary"
          className="btn-nav"
        >
          ← Tournaments
        </BtnLink>
        {tournament.isPublic && (
          <BtnLink
            href={`/orgs/${org.slug}/tournaments/${tournament.slug}`}
            variant="secondary"
            className="btn-nav"
          >
            Public page
          </BtnLink>
        )}
      </div>

      <TournamentBalanceSummary
        orgId={orgId}
        tournamentId={tournamentId}
        balancePence={tournament.balancePence}
      />

      {insights && insights.overview.matchesPlayed > 0 && (
        <section style={{ ...card, marginBottom: 28 }}>
          <h2 style={{ color: "var(--dk)", marginBottom: 12, fontSize: "1.1rem" }}>
            Season insights
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 800 }}>{insights.overview.matchesPlayed}</div>
              <div style={{ fontSize: "0.75rem", color: "#666" }}>Played</div>
            </div>
            {insights.leaderboards[0]?.entries[0] && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", fontWeight: 800 }}>
                  {insights.leaderboards[0].entries[0].value}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#666" }}>
                  Top runs ({insights.leaderboards[0].entries[0].name})
                </div>
              </div>
            )}
          </div>
          {tournament.isPublic && (
            <BtnLink
              href={`/orgs/${org.slug}/tournaments/${tournament.slug}`}
              variant="secondary"
              className="btn-nav"
            >
              View public tournament hub →
            </BtnLink>
          )}
        </section>
      )}

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
                    {m.scheduledAt
                      ? ` · ${m.scheduledAt.toISOString().slice(0, 10)}`
                      : ""}
                    {m.venue ? ` · ${m.venue}` : ""}
                    {m.marginText ? ` · ${m.marginText}` : ""}
                  </p>
                </div>
                <div
                  className="btn-group"
                  style={{ justifyContent: "flex-end", gap: 8 }}
                >
                  <BtnLink
                    href={`/match/${matchPublicRef(m)}`}
                    variant="secondary"
                    className="btn-nav"
                  >
                    Scorecard
                  </BtnLink>
                  <BtnLink href={`/match/${matchPublicRef(m)}/score`} className="btn-nav">
                    Score
                  </BtnLink>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <CreateMatchForm
          key={tournamentTeams.map((t) => t.id).join(",")}
          tournamentId={tournamentId}
          tournamentTeams={tournamentTeams}
        />
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
        <AddTournamentTeamForm tournamentId={tournamentId} teams={availableOrgTeams} />
      </section>

      <section>
        <h2 style={{ color: "var(--dk)", marginBottom: 12, fontSize: "1.1rem" }}>
          Manager invites
        </h2>
        <InviteList
          tournamentId={tournamentId}
          invites={invites.map((inv) => ({
            id: inv.id,
            email: inv.email,
            kind: inv.kind,
            role: inv.role,
            token: inv.token,
            team: inv.team ? { name: inv.team.name } : null,
          }))}
        />
        <InviteForm tournamentId={tournamentId} teams={orgTeams} />
      </section>
    </PageShell>
  );
}
