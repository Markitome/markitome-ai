import { Hono } from "hono";
import { z } from "zod";
import {
  runBlogWorkflow,
  runChatWorkflow,
  runEmailWorkflow,
  runImageWorkflow,
  runKnowledgeWorkflow,
  runPresentationWorkflow
} from "@markitome/workflows";
import { prisma } from "@markitome/db";
import { requireAuth } from "../middleware/auth";
import { assertUsageWithinLimits, logAiUsage, logAudit } from "../services/logging";

export const workflowRoutes = new Hono();

const schemas = {
  chat: z.object({
    message: z.string().min(1),
    context: z.string().optional().default(""),
    knowledgeSource: z.string().optional().default("")
  }),
  blog: z.object({
    clientName: z.string().min(1),
    website: z.string().optional().default(""),
    topic: z.string().min(1),
    targetKeyword: z.string().optional().default(""),
    tone: z.string().optional().default("Professional"),
    wordCount: z.string().optional().default("900"),
    audience: z.string().optional().default("Business decision makers"),
    useKnowledgeBase: z.boolean().optional().default(false)
  }),
  presentation: z.object({
    clientName: z.string().min(1),
    topic: z.string().min(1),
    objective: z.string().min(1),
    audience: z.string().optional().default("Stakeholders"),
    numberOfSlides: z.string().optional().default("8"),
    tone: z.string().optional().default("Professional"),
    useKnowledgeBase: z.boolean().optional().default(false)
  }),
  image: z.object({
    platform: z.string().min(1),
    format: z.string().min(1),
    brandColors: z.string().optional().default(""),
    campaignObjective: z.string().min(1),
    imageDescription: z.string().min(1),
    textOverlay: z.string().optional().default(""),
    styleDirection: z.string().optional().default("Clean corporate visual"),
    clientName: z.string().optional().default("")
  }),
  email: z.object({
    recipientContext: z.string().min(1),
    purpose: z.string().min(1),
    tone: z.string().optional().default("Professional"),
    keyPoints: z.string().min(1),
    desiredCta: z.string().optional().default("")
  }),
  knowledge: z.object({
    title: z.string().min(1),
    source: z.string().optional().default(""),
    content: z.string().min(1),
    tags: z.string().optional().default("")
  })
};

workflowRoutes.post("/chat/generate", requireAuth, async (c) => {
  const user = c.get("user");
  await assertUsageWithinLimits();
  const input = schemas.chat.parse(await c.req.json());
  const workflow = await runChatWorkflow(input);
  await logAiUsage(user, "/v1/workflows/chat/generate", "chat");
  await logAudit(user, "chat", "GENERATE_AI");
  return c.json({ data: workflow.output });
});

workflowRoutes.post("/blog/generate", requireAuth, async (c) => {
  const user = c.get("user");
  await assertUsageWithinLimits();
  const input = schemas.blog.parse(await c.req.json());
  const workflow = await runBlogWorkflow(input);
  await prisma.blogRecord.create({
    data: { title: workflow.output.seoTitle, input, output: workflow.output }
  }).catch(() => undefined);
  await logAiUsage(user, "/v1/workflows/blog/generate", "blog");
  await logAudit(user, "blog", "GENERATE_AI", { clientName: input.clientName });
  return c.json({ data: workflow.output });
});

workflowRoutes.post("/presentation/generate", requireAuth, async (c) => {
  const user = c.get("user");
  await assertUsageWithinLimits();
  const input = schemas.presentation.parse(await c.req.json());
  const workflow = await runPresentationWorkflow(input);
  await prisma.presentationRecord.create({
    data: { title: input.topic, input, output: workflow.output }
  }).catch(() => undefined);
  await logAiUsage(user, "/v1/workflows/presentation/generate", "presentation");
  await logAudit(user, "presentation", "GENERATE_AI", { clientName: input.clientName });
  return c.json({ data: workflow.output });
});

workflowRoutes.post("/image/generate", requireAuth, async (c) => {
  const user = c.get("user");
  await assertUsageWithinLimits();
  const input = schemas.image.parse(await c.req.json());
  const workflow = await runImageWorkflow(input);
  await prisma.imageGenerationRecord.create({
    data: { prompt: workflow.output.promptUsed, metadata: workflow.output }
  }).catch(() => undefined);
  await logAiUsage(user, "/v1/workflows/image/generate", "image");
  await logAudit(user, "image", "GENERATE_AI", { platform: input.platform });
  return c.json({ data: workflow.output });
});

workflowRoutes.post("/email/generate", requireAuth, async (c) => {
  const user = c.get("user");
  await assertUsageWithinLimits();
  const input = schemas.email.parse(await c.req.json());
  const workflow = await runEmailWorkflow(input);
  await logAiUsage(user, "/v1/workflows/email/generate", "email");
  await logAudit(user, "email", "GENERATE_AI");
  return c.json({ data: workflow.output });
});

workflowRoutes.post("/knowledge/generate", requireAuth, async (c) => {
  const user = c.get("user");
  await assertUsageWithinLimits();
  const input = schemas.knowledge.parse(await c.req.json());
  const workflow = await runKnowledgeWorkflow(input);
  await prisma.knowledgeDocument.create({
    data: {
      title: input.title,
      source: input.source,
      vectorIds: workflow.output.vectorIds,
      metadata: workflow.output
    }
  }).catch(() => undefined);
  await logAiUsage(user, "/v1/workflows/knowledge/generate", "knowledge");
  await logAudit(user, "knowledge", "GENERATE_AI", { title: input.title });
  return c.json({ data: workflow.output });
});
