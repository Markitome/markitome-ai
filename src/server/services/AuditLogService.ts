import type { Context } from "hono";
import type { AppVariables, Env } from "../../types";
import { id } from "../utils/crypto";

type AppContext = Context<{ Bindings: Env; Variables: AppVariables }>;

export async function writeAuditLog(
  c: AppContext,
  input: {
    action: string;
    targetType: string;
    targetId?: string | null;
    metadata?: Record<string, unknown>;
    actorUserId?: string | null;
  }
): Promise<void> {
  const user = c.get("user");
  await c.env.DB.prepare(
    `INSERT INTO audit_logs (
      id, actor_user_id, target_type, target_id, action, ip_address, user_agent, metadata_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id("audit"),
      input.actorUserId ?? user?.id ?? null,
      input.targetType,
      input.targetId ?? null,
      input.action,
      c.req.header("CF-Connecting-IP") ?? null,
      c.req.header("User-Agent") ?? null,
      JSON.stringify(input.metadata ?? {}),
      new Date().toISOString()
    )
    .run();
}
