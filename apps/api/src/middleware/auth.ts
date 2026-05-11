import type { AppRole } from "@markitome/shared";
import type { Context, Next } from "hono";
import { jwtVerify } from "jose";

export type AuthUser = {
  id: string;
  email: string;
  roles: AppRole[];
};

declare module "hono" {
  interface ContextVariableMap {
    user: AuthUser;
  }
}

export async function requireAuth(c: Context, next: Next) {
  const authorization = c.req.header("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;

  if (!token) {
    return c.json({ error: "Missing bearer token" }, 401);
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return c.json({ error: "Authentication secret is not configured" }, 500);
  }

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const email = String(payload.email ?? "");
    const roles = Array.isArray(payload.roles) ? (payload.roles as AppRole[]) : ["TEAM_MEMBER"];

    c.set("user", {
      id: String(payload.sub ?? email),
      email,
      roles
    });

    await next();
  } catch {
    return c.json({ error: "Invalid token" }, 401);
  }
}

export function requireRole(allowedRoles: AppRole[]) {
  return async (c: Context, next: Next) => {
    const user = c.get("user");
    if (!user.roles.some((role) => allowedRoles.includes(role))) {
      return c.json({ error: "Insufficient role" }, 403);
    }

    await next();
  };
}
