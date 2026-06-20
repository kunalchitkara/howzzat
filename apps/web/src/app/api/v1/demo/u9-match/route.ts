import { json } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { assertDemoResetAllowed } from "@/lib/demo/demo-reset-guard";
import { resetOrCreateU9DemoMatch } from "@/lib/demo/u9-demo";

export const runtime = "nodejs";

/** Create or reset a U9-style 4-over demo (4 players per side, 10 in roster, 200 start, −5 per wicket). */
export const POST = withApi(async (request) => {
  assertDemoResetAllowed(request);
  const data = await resetOrCreateU9DemoMatch();
  return json({ data }, data.reset ? 200 : 201);
});
