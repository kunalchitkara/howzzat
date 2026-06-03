import { json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { createOrganizationSchema } from "@/lib/validations";
import {
  createOrganization,
  listOrganizations,
} from "@/lib/services/organizations";

export const runtime = "nodejs";

export const GET = withApi(async () => {
  const organizations = await listOrganizations();
  return json({ data: organizations });
});

export const POST = withApi(async (request) => {
  const input = await parseJson(request, createOrganizationSchema);
  const organization = await createOrganization(input);
  return json({ data: organization }, 201);
});
