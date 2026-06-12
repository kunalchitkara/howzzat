import Link from "next/link";
import { notFound } from "next/navigation";
import { CreateTeamForm } from "@/components/dashboard/forms";
import { BtnLink, PageShell, card } from "@/components/dashboard/ui";
import { getOrganization } from "@/lib/services/organizations";
import { ApiError } from "@/lib/api/http";

export default async function TeamsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  let org;
  try {
    org = await getOrganization(orgId);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  return (
    <PageShell title="Teams" subtitle={org.name}>
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
        {org.teams.map((team) => (
          <li key={team.id} style={card}>
            <Link
              href={`/dashboard/organizations/${orgId}/teams/${team.id}`}
              style={{ fontWeight: 700, color: "var(--dk)" }}
            >
              {team.name}
            </Link>
            {team.ageGroup && (
              <span style={{ color: "#666", marginLeft: 8, fontSize: "0.9rem" }}>
                {team.ageGroup}
              </span>
            )}
          </li>
        ))}
      </ul>

      <h2 style={{ color: "var(--dk)", marginBottom: 12, fontSize: "1.1rem" }}>
        Add team
      </h2>
      <CreateTeamForm orgId={orgId} />
    </PageShell>
  );
}
