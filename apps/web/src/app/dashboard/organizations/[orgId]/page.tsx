import Link from "next/link";
import { notFound } from "next/navigation";
import { BtnLink, PageShell, card } from "@/components/dashboard/ui";
import { getOrganizationForUser } from "@/lib/services/organizations";
import { getServerUser } from "@/lib/auth/server";
import { ApiError } from "@/lib/api/http";

export const dynamic = "force-dynamic";

export default async function OrganizationPage({
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

  return (
    <PageShell title={org.name} subtitle={org.homeGround ?? org.slug}>
      <p style={{ marginBottom: 16 }}>
        <BtnLink href="/dashboard" variant="secondary" className="btn-nav">
          ← Dashboard
        </BtnLink>
      </p>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
        <Link href={`/dashboard/organizations/${org.id}/teams`} style={{ textDecoration: "none" }}>
          <div style={card}>
            <strong style={{ color: "var(--dk)" }}>Teams</strong>
            <p style={{ color: "#666", marginTop: 4 }}>{org.teams.length} squads</p>
          </div>
        </Link>
        <Link
          href={`/dashboard/organizations/${org.id}/tournaments`}
          style={{ textDecoration: "none" }}
        >
          <div style={card}>
            <strong style={{ color: "var(--dk)" }}>Tournaments</strong>
            <p style={{ color: "#666", marginTop: 4 }}>
              {org.tournaments.length} competitions
            </p>
          </div>
        </Link>
      </div>

      {org.tournaments[0]?.isPublic && (
        <div style={{ ...card, marginTop: 12 }}>
          <strong>Public page</strong>
          <p style={{ marginTop: 10 }}>
            <BtnLink
              href={`/orgs/${org.slug}/tournaments/${org.tournaments[0].slug}`}
              variant="secondary"
              className="btn-nav"
            >
              View public tournament
            </BtnLink>
          </p>
        </div>
      )}
    </PageShell>
  );
}
