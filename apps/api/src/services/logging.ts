import { prisma } from "@markitome/db";
import type { WorkflowName } from "@markitome/shared";
import type { AuthUser } from "../middleware/auth";

function userIdForPrisma(user: AuthUser) {
  return user.id.startsWith("cl") ? user.id : undefined;
}

export async function logAiUsage(user: AuthUser, route: string, workflow: WorkflowName) {
  await prisma.aiUsageLog
    .create({
      data: {
        userId: userIdForPrisma(user),
        provider: "cloudflare-workers-ai",
        model: process.env.CLOUDFLARE_TEXT_MODEL ?? "@cf/google/gemma-4-26b-a4b-it",
        route,
        metadata: {
          workflow,
          placeholderUsage: true,
          limits: {
            dailyLimitEnforced: false,
            monthlyLimitEnforced: false
          }
        }
      }
    })
    .catch(() => undefined);
}

export async function logAudit(
  user: AuthUser,
  resource: string,
  action: "GENERATE_AI" | "SAVE_TO_DRIVE" | "CREATE" | "UPDATE" | "DELETE" | "ROLE_CHANGE" | "ALLOWLIST_CHANGE",
  metadata?: Record<string, unknown>
) {
  await prisma.auditLog
    .create({
      data: {
        actorUserId: userIdForPrisma(user),
        action,
        resource,
        metadata
      }
    })
    .catch(() => undefined);
}

export async function assertUsageWithinLimits() {
  // TODO: Query ai_usage_logs by user/day/month and enforce plan-specific limits before AI calls.
  return { ok: true };
}
