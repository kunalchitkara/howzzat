import { redirect } from "next/navigation";
import { ScorePad } from "@/components/scoring/ScorePad";
import { matchPublicRef } from "@/lib/match-slug";
import { getMatch, shouldRedirectToMatchSlug } from "@/lib/services/matches";

export const metadata = {
  title: "Score match — Howzzat",
};

export default async function MatchScorePage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  const match = await getMatch(matchId);
  if (shouldRedirectToMatchSlug(matchId, match)) {
    redirect(`/match/${match.slug}/score`);
  }
  const matchUrlRef = matchPublicRef(match);
  return (
    <main>
      <ScorePad matchId={matchUrlRef} />
    </main>
  );
}
