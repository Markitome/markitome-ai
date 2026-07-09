import type { AppUser, Env } from "../../types";
import { base64UrlDecode, base64UrlEncode, hmacSha256, timingSafeEqual } from "../utils/crypto";

interface SessionPayload {
  userId: string;
  email: string;
  exp: number;
}

export const sessionCookieName = "mt_notetaker_session";

export async function createSessionToken(env: Env, user: AppUser): Promise<string> {
  const payload: SessionPayload = {
    userId: user.id,
    email: user.email,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await hmacSha256(env.SESSION_SECRET, encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export async function verifySessionToken(env: Env, token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;
  const expected = await hmacSha256(env.SESSION_SECRET, encodedPayload);
  if (!timingSafeEqual(signature, expected)) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
