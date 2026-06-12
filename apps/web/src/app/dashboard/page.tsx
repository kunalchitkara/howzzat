import Link from "next/link";
import { BtnLink, PageShell, card } from "@/components/dashboard/ui";
import { listOrganizationsForUser } from "@/lib/services/organizations";
import { getServerUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getServerUser();
  if (!user) return null;

  const organizations = await listOrganizationsForUser(user.id);

  return (
    <PageShell title="Your clubs" subtitle="Manage tournaments, teams, and fixtures">
      <p style={{ textAlign: "right", marginBottom: 16 }}>
        <BtnLink href="/dashboard/organizations/new">+ New club</BtnLink>
      </p>
      {organizations.length === 0 ? (
        <div style={card}>
          <p style={{ color: "#666", marginBottom: 12 }}>
            You are not part of any club yet. Create one or accept an invite from your
            tournament manager.
          </p>
          <BtnLink href="/dashboard/organizations/new">Create your first club</BtnLink>
        </div>
      ) : (
        <ul style={{ listStyle: "none" }}>
          {organizations.map((org) => (
            <li key={org.id} style={card}>
              <Link
                href={`/dashboard/organizations/${org.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <strong style={{ fontSize: "1.1rem", color: "var(--dk)" }}>
                  {org.name}
                </strong>
                <p style={{ color: "#666", fontSize: "0.9rem", marginTop: 4 }}>
                  {org._count.teams} teams · {org._count.tournaments} tournaments ·{" "}
                  {org.memberships[0]?.role ?? "member"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
