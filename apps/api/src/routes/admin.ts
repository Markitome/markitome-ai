import { prisma } from "@markitome/db";
import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth";
import { logAudit } from "../services/logging";

export const adminRoutes = new Hono();

adminRoutes.use("*", requireAuth, requireRole(["ADMIN", "MANAGER"]));

adminRoutes.get("/summary", async (c) => {
  const [users, usageLogs, generatedFiles, auditLogs] = await Promise.all([
    prisma.user.count().catch(() => 0),
    prisma.aiUsageLog.count().catch(() => 0),
    prisma.generatedFile.count().catch(() => 0),
    prisma.auditLog.count().catch(() => 0)
  ]);

  return c.json({
    data: {
      users,
      usageLogs,
      generatedFiles,
      auditLogs,
      dailyUsageLimitPlaceholder: "TODO: Configure per-role daily limits.",
      monthlyUsageLimitPlaceholder: "TODO: Configure per-role monthly limits."
    }
  });
});

adminRoutes.get("/users", async (c) => {
  const users = await prisma.user
    .findMany({
      take: 50,
      orderBy: { createdAt: "desc" },
      include: { roles: { include: { role: true } } }
    })
    .catch(() => []);

  return c.json({
    data: users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
      roles: user.roles.map((role) => role.role.name)
    }))
  });
});

adminRoutes.post("/allowlist", async (c) => {
  const actor = c.get("user");
  const input = z.object({ email: z.string().email(), note: z.string().optional() }).parse(await c.req.json());
  const record = await prisma.approvedEmailAllowlist.upsert({
    where: { email: input.email.toLowerCase() },
    update: { note: input.note },
    create: { email: input.email.toLowerCase(), note: input.note, createdBy: actor.email }
  });

  await logAudit(actor, "approved_email_allowlist", "ALLOWLIST_CHANGE", { email: record.email });
  return c.json({ data: record });
});

adminRoutes.post("/users/:userId/roles", requireRole(["ADMIN"]), async (c) => {
  const actor = c.get("user");
  const userId = c.req.param("userId");
  const input = z.object({ role: z.enum(["ADMIN", "MANAGER", "TEAM_MEMBER", "INTERN"]) }).parse(await c.req.json());
  const role = await prisma.role.upsert({
    where: { name: input.role },
    update: {},
    create: { name: input.role, description: `${input.role} role` }
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId, roleId: role.id } },
    update: {},
    create: { userId, roleId: role.id }
  });

  await logAudit(actor, "user_role", "ROLE_CHANGE", { userId, role: input.role });
  return c.json({ data: { userId, role: input.role } });
});
