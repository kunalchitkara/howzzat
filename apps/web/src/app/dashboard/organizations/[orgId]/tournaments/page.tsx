import Link from "next/link";
import { notFound } from "next/navigation";
import { BtnLink, PageShell, card } from "@/components/dashboard/ui";
import { userHasOrgRole } from "@/lib/auth/request";
import { getOrganizationForUser } from "@/lib/services/organizations";
import { getServerUser } from "@/lib/auth/server";
import { ApiError } from "@/lib/api/http";

export default async function TournamentsPage({
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

  const canCreateTournament = userHasOrgRole(user, orgId, ["OWNER", "MANAGER"]);

  return (
    <PageShell title="Tournaments" subtitle={org.name}>
      {canCreateTournament && (
        <p style={{ textAlign: "right", marginBottom: 16 }}>
          <BtnLink href={`/dashboard/organizations/${orgId}/tournaments/new`}>
            + New tournament
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

      <ul style={{ listStyle: "none" }}>
        {org.tournaments.length === 0 ? (
          <li style={{ ...card, color: "#666" }}>
            <p>{canCreateTournament ? "No tournaments yet." : "No tournaments you manage."}</p>
            {canCreateTournament && (
              <p style={{ marginTop: 12 }}>
                <BtnLink href={`/dashboard/organizations/${orgId}/tournaments/new`}>
                  Create tournament
                </BtnLink>
              </p>
            )}
          </li>
        ) : (
          org.tournaments.map((t) => (
            <li key={t.id} style={card}>
              <Link
                href={`/dashboard/organizations/${orgId}/tournaments/${t.id}`}
                style={{ fontWeight: 700, color: "var(--dk)" }}
              >
                {t.name}
              </Link>
              <p style={{ color: "#666", fontSize: "0.9rem", marginTop: 4 }}>
                {t.ageGroup} · {t.seasonLabel ?? "—"} ·{" "}
                {t.rulesProfileVersion?.template?.name ?? "Rules profile"}
              </p>
              {t.isPublic && (
                <p style={{ marginTop: 10 }}>
                  <BtnLink
                    href={`/orgs/${org.slug}/tournaments/${t.slug}`}
                    variant="secondary"
                    className="btn-nav"
                  >
                    Public page
                  </BtnLink>
                </p>
              )}
            </li>
          ))
        )}
      </ul>
    </PageShell>
  );
}
