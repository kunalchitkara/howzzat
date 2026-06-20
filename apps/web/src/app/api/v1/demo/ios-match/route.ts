import { json } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { assertDemoResetAllowed } from "@/lib/demo/demo-reset-guard";
import { resetOrCreateIosDemoMatch } from "@/lib/demo/ios-demo";

export const runtime = "nodejs";

/** Create or reset a 2-over pairs demo match for the iOS scorer. */
export const POST = withApi(async (request) => {
  assertDemoResetAllowed(request);
  const data = await resetOrCreateIosDemoMatch();
  return json({ data }, data.reset ? 200 : 201);
});
