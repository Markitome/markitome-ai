import { prisma } from "@markitome/db";
import type { ProposalInput } from "@markitome/shared";
import { runProposalWorkflow } from "@markitome/workflows";
import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { assertUsageWithinLimits, logAiUsage, logAudit } from "../services/logging";

export const proposalRoutes = new Hono();

const proposalInputSchema = z.object({
  clientName: z.string().min(1),
  clientWebsite: z.string().optional().default(""),
  industry: z.string().optional().default(""),
  requiredServices: z.string().min(1),
  budgetRange: z.string().optional().default(""),
  timeline: z.string().optional().default(""),
  proposalObjective: z.string().min(1),
  notes: z.string().optional().default(""),
  useKnowledgeBase: z.boolean().optional().default(false)
});

proposalRoutes.post("/generate", requireAuth, async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const input = proposalInputSchema.parse(body) satisfies ProposalInput;

  await assertUsageWithinLimits();
  const workflow = await runProposalWorkflow(input);

  await prisma.proposalRecord.create({
    data: {
      title: workflow.output.proposalTitle,
      input,
      output: workflow.output
    }
  }).catch(() => undefined);

  await logAiUsage(user, "/v1/proposals/generate", "proposal");
  await logAudit(user, "proposal", "GENERATE_AI", { clientName: input.clientName });

  return c.json({ data: workflow.output });
});
