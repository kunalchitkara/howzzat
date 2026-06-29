import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Compatibility route for legacy shared links from older audit captures. */
export default function LegacyU9TournamentPage() {
  redirect("/orgs/edgware-cc/tournaments/u9-2026");
}
