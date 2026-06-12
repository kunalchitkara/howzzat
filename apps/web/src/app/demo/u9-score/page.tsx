import { redirect } from "next/navigation";
import { resetOrCreateU9DemoMatch } from "@/lib/demo/u9-demo";

export const dynamic = "force-dynamic";

/** Reset u9-live and open the scorer (fresh teams + rosters every visit). */
export default async function U9DemoScorePage() {
  const { matchId } = await resetOrCreateU9DemoMatch();
  redirect(`/match/${matchId}/score`);
}
