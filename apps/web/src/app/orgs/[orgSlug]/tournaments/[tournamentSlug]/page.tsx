import { notFound } from "next/navigation";
import { TournamentHub } from "@/components/tournament/TournamentHub";
import "@/components/tournament/tournament-hub.css";
import { getTournamentBySlug } from "@/lib/services/tournaments";
import { getPublicTournamentInsights } from "@/lib/services/tournament-insights";
import { ApiError } from "@/lib/api/http";

export const dynamic = "force-dynamic";

export default async function PublicTournamentPage({
  params,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string }>;
}) {
  const { orgSlug, tournamentSlug } = await params;
  let tournament;
  let insights;
  try {
    [tournament, insights] = await Promise.all([
      getTournamentBySlug(orgSlug, tournamentSlug),
      getPublicTournamentInsights(orgSlug, tournamentSlug),
    ]);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const org = tournament.organization;

  return (
    <main style={{ background: "#eef2f7", minHeight: "100vh" }}>
      <TournamentHub
        orgName={org.name}
        tournamentName={tournament.name}
        ageGroup={tournament.ageGroup}
        seasonLabel={tournament.seasonLabel}
        rulesName={tournament.rulesProfileVersion?.template?.name}
        teams={tournament.teams.map((tt) => ({
          id: tt.id,
          name: tt.team.name,
        }))}
        insights={insights}
      />
    </main>
  );
}
