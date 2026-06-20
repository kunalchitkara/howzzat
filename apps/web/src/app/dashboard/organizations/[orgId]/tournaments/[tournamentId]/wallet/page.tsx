import { Suspense } from "react";
import { notFound } from "next/navigation";
import { TournamentWalletPanel } from "@/components/dashboard/TournamentWalletPanel";
import { BtnLink, PageShell } from "@/components/dashboard/ui";
import { getTournament } from "@/lib/services/tournaments";
import { getOrganization } from "@/lib/services/organizations";
import { ApiError } from "@/lib/api/http";

export const dynamic = "force-dynamic";

export default async function TournamentWalletPage({
  params,
}: {
  params: Promise<{ orgId: string; tournamentId: string }>;
}) {
  const { orgId, tournamentId } = await params;
  let tournament;
  let _org;
  try {
    [tournament, _org] = await Promise.all([
      getTournament(tournamentId),
      getOrganization(orgId),
    ]);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  if (tournament.organizationId !== orgId) notFound();

  const tournamentHref = `/dashboard/organizations/${orgId}/tournaments/${tournamentId}`;

  return (
    <PageShell title="Tournament wallet" subtitle={tournament.name}>
      <div className="btn-group" style={{ marginBottom: 16 }}>
        <BtnLink href={tournamentHref} variant="secondary" className="btn-nav">
          ← {tournament.name}
        </BtnLink>
        <BtnLink
          href={`/dashboard/organizations/${orgId}/tournaments`}
          variant="secondary"
          className="btn-nav"
        >
          Tournaments
        </BtnLink>
      </div>

      <Suspense fallback={null}>
        <TournamentWalletPanel
          tournamentId={tournamentId}
          orgId={orgId}
          balancePence={tournament.balancePence}
          walletPage
          showCouponRedeem
        />
      </Suspense>
    </PageShell>
  );
}
