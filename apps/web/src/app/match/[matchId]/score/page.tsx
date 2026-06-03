import { ScorePad } from "@/components/scoring/ScorePad";

export const metadata = {
  title: "Score match — Howzzat",
};

export default async function MatchScorePage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  return (
    <main>
      <ScorePad matchId={matchId} />
    </main>
  );
}
