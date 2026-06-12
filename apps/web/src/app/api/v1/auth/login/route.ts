import { ApiError, json, parseJson } from "@/lib/api/http";
import { withApi } from "@/lib/api/handler";
import {
  createSession,
  findOrCreateUser,
  sessionCookieValue,
} from "@/lib/auth/session";
import { loginSchema } from "@/lib/validations";

export const runtime = "nodejs";

/** Passwordless sign-in for local dev and automated tests only. */
export const POST = withApi(async (request) => {
  if (process.env.NODE_ENV === "production") {
    throw new ApiError(
      410,
      "Use email code, password, or Google sign-in",
      "LOGIN_DEPRECATED",
    );
  }
  const input = await parseJson(request, loginSchema);
  const user = await findOrCreateUser(input.email, input.name);
  const { token } = await createSession(user.id);
  const response = json({
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
  });
  response.headers.set("Set-Cookie", sessionCookieValue(token));
  return response;
});
