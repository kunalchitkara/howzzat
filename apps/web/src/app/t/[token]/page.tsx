import { notFound, redirect } from "next/navigation";
import { ApiError } from "@/lib/api/http";
import { publicTournamentHubPath } from "@/lib/services/tournament-access";
import { getTournamentByPublicToken } from "@/lib/services/tournaments";

export const dynamic = "force-dynamic";

/** Magic-link entry for public tournament hubs (`/t/{publicToken}`). */
export default async function PublicTournamentTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  try {
    const tournament = await getTournamentByPublicToken(token);
    redirect(
      publicTournamentHubPath(
        tournament.organization.slug,
        tournament.slug,
      ),
    );
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}
