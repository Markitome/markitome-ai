import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { AppVariables, Env, RoleName } from "../../types";
import { ApiError } from "../http/errors";
import { id } from "../utils/crypto";
import { createSessionToken, sessionCookieName } from "./session";
import { loadUser } from "./rbac";

const oauthStateCookie = "mt_oauth_state";

interface GoogleUserInfo {
  email?: string;
  name?: string;
  picture?: string;
  verified_email?: boolean;
}

export const authRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

authRoutes.get("/login", async (c) => {
  if (!c.env.GOOGLE_CLIENT_ID) {
    return c.redirect("/setup-required?missing=GOOGLE_CLIENT_ID");
  }

  const state = crypto.randomUUID();
  setCookie(c, oauthStateCookie, state, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 600
  });

  const redirectUri = `${new URL(c.req.url).origin}/api/auth/callback`;
  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account"
  });

  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

authRoutes.get("/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const expectedState = getCookie(c, oauthStateCookie);
  deleteCookie(c, oauthStateCookie, { path: "/" });

  if (!code || !state || state !== expectedState) {
    throw new ApiError(400, "invalid_oauth_state", "OAuth callback state could not be verified.");
  }
  if (!c.env.GOOGLE_CLIENT_ID || !c.env.GOOGLE_CLIENT_SECRET) {
    return c.redirect("/setup-required?missing=GOOGLE_CLIENT_ID,GOOGLE_CLIENT_SECRET");
  }

  const origin = new URL(c.req.url).origin;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${origin}/api/auth/callback`,
      grant_type: "authorization_code"
    })
  });

  if (!tokenResponse.ok) {
    throw new ApiError(401, "oauth_exchange_failed", "Google OAuth token exchange failed.");
  }
  const tokenJson = (await tokenResponse.json()) as { access_token?: string };
  if (!tokenJson.access_token) {
    throw new ApiError(401, "oauth_missing_access_token", "Google did not return an access token.");
  }

  const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { authorization: `Bearer ${tokenJson.access_token}` }
  });
  if (!userInfoResponse.ok) {
    throw new ApiError(401, "oauth_userinfo_failed", "Could not fetch Google user profile.");
  }

  const googleUser = (await userInfoResponse.json()) as GoogleUserInfo;
  if (!googleUser.email || googleUser.verified_email === false) {
    throw new ApiError(403, "email_unverified", "A verified Google email address is required.");
  }

  const email = googleUser.email.toLowerCase();
  const isInternal = email.endsWith(`@${c.env.ALLOWED_EMAIL_DOMAIN}`);
  const isSeedSuperAdmin = email === "vivek@markitome.com";
  const existing = await c.env.DB.prepare("SELECT id, approval_status AS approvalStatus FROM users WHERE email = ?")
    .bind(email)
    .first<{ id: string; approvalStatus: string }>();

  const userId = existing?.id ?? (isSeedSuperAdmin ? "user_vivek_markitome_com" : id("user"));
  const approvalStatus = isSeedSuperAdmin || isInternal || existing?.approvalStatus === "approved" ? "approved" : "pending";

  await c.env.DB.prepare(
    `INSERT INTO users (id, email, name, avatar_url, approval_status, approved_at, last_login_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET
       name = excluded.name,
       avatar_url = excluded.avatar_url,
       approval_status = CASE
         WHEN users.approval_status = 'approved' THEN 'approved'
         ELSE excluded.approval_status
       END,
       last_login_at = excluded.last_login_at,
       updated_at = excluded.updated_at`
  )
    .bind(
      userId,
      email,
      googleUser.name ?? null,
      googleUser.picture ?? null,
      approvalStatus,
      approvalStatus === "approved" ? new Date().toISOString() : null,
      new Date().toISOString(),
      new Date().toISOString(),
      new Date().toISOString()
    )
    .run();

  await ensureRole(c.env, userId, isSeedSuperAdmin ? "super_admin" : "employee");

  const user = await loadUser(c.env, userId);
  if (!user || user.approvalStatus !== "approved") return c.redirect("/unauthorized");

  const token = await createSessionToken(c.env, user);
  setCookie(c, sessionCookieName, token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });

  return c.redirect("/dashboard");
});

authRoutes.post("/logout", (c) => {
  deleteCookie(c, sessionCookieName, { path: "/" });
  return c.json({ ok: true });
});

authRoutes.get("/me", async (c) => {
  const cookie = getCookie(c, sessionCookieName);
  if (!cookie) return c.json({ user: null });
  const { verifySessionToken } = await import("./session");
  const payload = await verifySessionToken(c.env, cookie);
  if (!payload) return c.json({ user: null });
  const user = await loadUser(c.env, payload.userId);
  return c.json({ user });
});

async function ensureRole(env: Env, userId: string, roleName: RoleName): Promise<void> {
  const role = await env.DB.prepare("SELECT id FROM roles WHERE name = ?").bind(roleName).first<{ id: string }>();
  if (!role) throw new ApiError(500, "missing_role", `Role ${roleName} is missing from the database.`);
  await env.DB.prepare(
    `INSERT OR IGNORE INTO user_roles (id, user_id, role_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(id("user_role"), userId, role.id, new Date().toISOString(), new Date().toISOString())
    .run();
}
