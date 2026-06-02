import { listBuiltinProfiles } from "@howzzat/rules-engine";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    profiles: listBuiltinProfiles(),
  });
}
