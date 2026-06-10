import { cookies } from "next/headers";
import {
  getUserBySessionToken,
  SESSION_COOKIE,
  type AuthUser,
} from "./session";

export async function getServerUser(): Promise<AuthUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  return getUserBySessionToken(token);
}
