import type { Context, MiddlewareHandler, Next } from "hono";
import { getCookie } from "hono/cookie";
import type { AppUser, AppVariables, Env, RoleName } from "../../types";
import { ApiError } from "../http/errors";
import { sessionCookieName, verifySessionToken } from "./session";

type AppContext = Context<{ Bindings: Env; Variables: AppVariables }>;

export function hasRole(user: AppUser, roles: RoleName[]): boolean {
  return user.roles.some((role) => roles.includes(role));
}

export function isAdmin(user: AppUser): boolean {
  return hasRole(user, ["admin", "super_admin"]);
}

export function isSuperAdmin(user: AppUser): boolean {
  return hasRole(user, ["super_admin"]);
}

export async function loadUser(env: Env, userId: string): Promise<AppUser | null> {
  const user = await env.DB.prepare(
    `SELECT id, email, name, avatar_url AS avatarUrl, approval_status AS approvalStatus
     FROM users
     WHERE id = ? AND deleted_at IS NULL`
  )
    .bind(userId)
    .first<AppUser>();
  if (!user) return null;

  const rolesResult = await env.DB.prepare(
    `SELECT r.name
     FROM roles r
     INNER JOIN user_roles ur ON ur.role_id = r.id
     WHERE ur.user_id = ?`
  )
    .bind(userId)
    .all<{ name: RoleName }>();

  user.roles = rolesResult.results.map((row) => row.name);
  return user;
}

export const requireAuth: MiddlewareHandler<{ Bindings: Env; Variables: AppVariables }> = async (c, next) => {
  const payload = await verifySessionToken(c.env, getCookie(c, sessionCookieName));
  if (!payload) throw new ApiError(401, "unauthenticated", "Authentication is required.");
  const user = await loadUser(c.env, payload.userId);
  if (!user || user.approvalStatus !== "approved") {
    throw new ApiError(403, "unauthorized", "Your account is not approved for this workspace.");
  }
  c.set("user", user);
  await next();
};

export function requireRoles(roles: RoleName[]): MiddlewareHandler<{ Bindings: Env; Variables: AppVariables }> {
  return async (c: AppContext, next: Next) => {
    const user = c.get("user");
    if (!user || !hasRole(user, roles)) {
      throw new ApiError(403, "forbidden", "You do not have permission to perform this action.");
    }
    await next();
  };
}

export async function canAccessMeeting(c: AppContext, meetingId: string): Promise<boolean> {
  const user = c.get("user");
  if (isAdmin(user)) return true;
  const meeting = await c.env.DB.prepare(
    `SELECT id FROM meetings
     WHERE id = ? AND deleted_at IS NULL
       AND (
         owner_user_id = ?
         OR id IN (SELECT meeting_id FROM share_permissions WHERE shared_with_user_id = ?)
       )`
  )
    .bind(meetingId, user.id, user.id)
    .first();
  return Boolean(meeting);
}

export async function assertCanAccessMeeting(c: AppContext, meetingId: string): Promise<void> {
  if (!(await canAccessMeeting(c, meetingId))) {
    throw new ApiError(404, "not_found", "Meeting not found.");
  }
}
