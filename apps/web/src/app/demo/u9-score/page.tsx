import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { resetOrCreateU9DemoMatch } from "@/lib/demo/u9-demo";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Reset u9-live and open the scorer (fresh teams + rosters every visit). */
export default async function U9DemoScorePage() {
  try {
    const { matchSlug } = await resetOrCreateU9DemoMatch();
    redirect(`/match/${matchSlug}/score`);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    // Avoid surfacing a hard 500 when demo reset fails in production.
    const existing = await prisma.match.findFirst({
      where: { publicSlug: "u9-live" },
      select: { id: true, slug: true },
      orderBy: { updatedAt: "desc" },
    });
    if (existing) {
      redirect(`/match/${existing.slug ?? existing.id}/score`);
    }
    redirect("/demo?demoStatus=u9-unavailable");
  }
}
