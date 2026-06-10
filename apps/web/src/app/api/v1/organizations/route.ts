import { json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import { getRequestUser } from "@/lib/auth/request";
import { createOrganizationSchema } from "@/lib/validations";
import {
  createOrganization,
  listOrganizations,
  listOrganizationsForUser,
} from "@/lib/services/organizations";

export const runtime = "nodejs";

export const GET = withApi(async (request) => {
  const user = await getRequestUser(request);
  const organizations = user
    ? await listOrganizationsForUser(user.id)
    : await listOrganizations();
  return json({ data: organizations });
});

export const POST = withApi(async (request) => {
  const user = await getRequestUser(request);
  const input = await parseJson(request, createOrganizationSchema);
  const organization = await createOrganization(input, user?.id);
  return json({ data: organization }, 201);
});
