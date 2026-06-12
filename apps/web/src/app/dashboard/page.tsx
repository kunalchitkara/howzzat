import Link from "next/link";
import { BtnLink, PageShell, card } from "@/components/dashboard/ui";
import { listOrganizationsForUser } from "@/lib/services/organizations";
import { listTournamentsForUser } from "@/lib/services/tournaments";
import { getServerUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getServerUser();
  if (!user) return null;

  const [organizations, managedTournaments] = await Promise.all([
    listOrganizationsForUser(user.id),
    listTournamentsForUser(user.id),
  ]);

  const hasAnything = organizations.length > 0 || managedTournaments.length > 0;

  return (
    <PageShell title="Your clubs" subtitle="Manage tournaments, teams, and fixtures">
      <p style={{ textAlign: "right", marginBottom: 16 }}>
        <BtnLink href="/dashboard/organizations/new">+ New club</BtnLink>
      </p>

      {managedTournaments.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: "1rem", marginBottom: 12, color: "var(--dk)" }}>
            My tournaments
          </h2>
          <ul style={{ listStyle: "none" }}>
            {managedTournaments.map((t) => (
              <li key={t.id} style={card}>
                <Link
                  href={`/dashboard/organizations/${t.organizationId}/tournaments/${t.id}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <strong style={{ fontSize: "1.05rem", color: "var(--dk)" }}>
                    {t.name}
                  </strong>
                  <p style={{ color: "#666", fontSize: "0.9rem", marginTop: 4 }}>
                    {t.organization.name} · {t.ageGroup}
                    {t.seasonLabel ? ` · ${t.seasonLabel}` : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!hasAnything ? (
        <div style={card}>
          <p style={{ color: "#666", marginBottom: 12 }}>
            You are not part of any club yet. Create one or accept an invite from your
            tournament manager.
          </p>
          <BtnLink href="/dashboard/organizations/new">Create your first club</BtnLink>
        </div>
      ) : organizations.length > 0 ? (
        <section>
          {managedTournaments.length > 0 && (
            <h2 style={{ fontSize: "1rem", marginBottom: 12, color: "var(--dk)" }}>
              Your clubs
            </h2>
          )}
          <ul style={{ listStyle: "none" }}>
            {organizations.map((org) => {
              const membershipRole = org.memberships[0]?.role;
              const managedCount = org.tournaments.length;
              const tournamentLabel = membershipRole
                ? `${org._count.tournaments} tournaments`
                : managedCount === 1
                  ? "1 tournament you manage"
                  : `${managedCount} tournaments you manage`;

              return (
                <li key={org.id} style={card}>
                  <Link
                    href={`/dashboard/organizations/${org.id}`}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <strong style={{ fontSize: "1.1rem", color: "var(--dk)" }}>
                      {org.name}
                    </strong>
                    <p style={{ color: "#666", fontSize: "0.9rem", marginTop: 4 }}>
                      {org._count.teams} teams · {tournamentLabel} ·{" "}
                      {membershipRole ?? "tournament manager"}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </PageShell>
  );
}
