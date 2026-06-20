import Link from "next/link";
import { notFound } from "next/navigation";
import { CreateTeamForm } from "@/components/dashboard/forms";
import { BtnLink, PageShell, card } from "@/components/dashboard/ui";
import { userHasOrgRole } from "@/lib/auth/request";
import { getServerUser } from "@/lib/auth/server";
import { getOrganizationForUser } from "@/lib/services/organizations";
import { ApiError } from "@/lib/api/http";
import { formatPlayerCount } from "@/lib/dashboard/summaries";

export default async function TeamsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const user = await getServerUser();
  if (!user) notFound();

  let org;
  try {
    org = await getOrganizationForUser(orgId, user.id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const canManageTeams = userHasOrgRole(user, orgId, ["OWNER", "MANAGER"]);

  return (
    <PageShell title="Teams" subtitle={org.name}>
      {canManageTeams && (
        <p style={{ textAlign: "right", marginBottom: 16 }}>
          <BtnLink href="#add-team" className="btn-nav">
            + New team
          </BtnLink>
        </p>
      )}
      <p style={{ marginBottom: 16 }}>
        <BtnLink
          href={`/dashboard/organizations/${orgId}`}
          variant="secondary"
          className="btn-nav"
        >
          ← {org.name}
        </BtnLink>
      </p>

      <h2 style={{ color: "var(--dk)", marginBottom: 12, fontSize: "1.1rem" }}>
        Your squads
      </h2>
      <ul style={{ listStyle: "none", marginBottom: 24 }}>
        {org.teams.length === 0 ? (
          <li style={{ ...card, color: "#666" }}>
            <p>{canManageTeams ? "No teams yet." : "No teams in this organization."}</p>
            {canManageTeams && (
              <p style={{ marginTop: 12 }}>
                <BtnLink href="#add-team">Create team</BtnLink>
              </p>
            )}
          </li>
        ) : (
          org.teams.map((team) => (
            <li key={team.id} style={card}>
              <Link
                href={`/dashboard/organizations/${orgId}/teams/${team.id}`}
                style={{ fontWeight: 700, color: "var(--dk)" }}
              >
                {team.name}
              </Link>
              <span style={{ color: "#666", marginLeft: 8, fontSize: "0.9rem" }}>
                · {formatPlayerCount(team.memberships.length)}
              </span>
              {team.ageGroup && (
                <span style={{ color: "#666", marginLeft: 8, fontSize: "0.9rem" }}>
                  {team.ageGroup}
                </span>
              )}
            </li>
          ))
        )}
      </ul>

      {canManageTeams && (
        <>
          <h2
            id="add-team"
            style={{ color: "var(--dk)", marginBottom: 12, fontSize: "1.1rem" }}
          >
            Add team
          </h2>
          <CreateTeamForm orgId={orgId} />
        </>
      )}
    </PageShell>
  );
}
