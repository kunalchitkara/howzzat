import Link from "next/link";
import { notFound } from "next/navigation";
import { CreateTournamentForm } from "@/components/dashboard/forms";
import { PageShell } from "@/components/dashboard/ui";
import { getOrganization } from "@/lib/services/organizations";
import { listRulesTemplates } from "@/lib/services/rules";
import { ApiError } from "@/lib/api/http";

export default async function NewTournamentPage({
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
    <PageShell title="New tournament" subtitle={org.name}>
      <p style={{ marginBottom: 16 }}>
        <Link href={`/dashboard/organizations/${orgId}/tournaments`}>
          ← Tournaments
        </Link>
      </p>
      <CreateTournamentForm
        orgId={orgId}
        templates={await listRulesTemplates(true)}
      />
    </PageShell>
  );
}
