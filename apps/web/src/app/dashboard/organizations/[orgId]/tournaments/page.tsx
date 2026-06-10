import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell, card } from "@/components/dashboard/ui";
import { getOrganization } from "@/lib/services/organizations";
import { ApiError } from "@/lib/api/http";

export default async function TournamentsPage({
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
    <PageShell title="Tournaments" subtitle={org.name}>
      <p style={{ textAlign: "right", marginBottom: 16 }}>
        <Link
          href={`/dashboard/organizations/${orgId}/tournaments/new`}
          style={{
            background: "var(--md)",
            color: "#fff",
            padding: "10px 16px",
            borderRadius: 8,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          + New tournament
        </Link>
      </p>
      <p style={{ marginBottom: 16 }}>
        <Link href={`/dashboard/organizations/${orgId}`}>← {org.name}</Link>
      </p>

      <ul style={{ listStyle: "none" }}>
        {org.tournaments.length === 0 ? (
          <li style={{ ...card, color: "#666" }}>
            No tournaments yet.{" "}
            <Link href={`/dashboard/organizations/${orgId}/tournaments/new`}>
              Create one →
            </Link>
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
                <p style={{ fontSize: "0.85rem", marginTop: 6 }}>
                  <Link href={`/orgs/${org.slug}/tournaments/${t.slug}`}>
                    Public page →
                  </Link>
                </p>
              )}
            </li>
          ))
        )}
      </ul>
    </PageShell>
  );
}
