import { SignJWT } from "jose";
import { getServerSession } from "next-auth";
import {
  runBlogWorkflow,
  runChatWorkflow,
  runEmailWorkflow,
  runImageWorkflow,
  runKnowledgeWorkflow,
  runPresentationWorkflow,
  runProposalWorkflow
} from "@markitome/workflows";
import { saveGeneratedFileToDrive } from "@markitome/google";
import { authOptions } from "./auth";

export async function proxyApiRequest(path: string, body?: unknown) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return Response.json({ error: "Authentication secret is not configured" }, { status: 500 });
  }

  if (!process.env.API_BASE_URL) {
    return runLocalWorkflow(path, body);
  }

  const apiToken = await new SignJWT({
    email: session.user.email,
    roles: session.user.roles
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.user.id)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(new TextEncoder().encode(secret));

  const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:4000";
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  return Response.json(await response.json(), { status: response.status });
}

async function runLocalWorkflow(path: string, body: unknown) {
  if (path === "/v1/proposals/generate") {
    const workflow = await runProposalWorkflow(body as never);
    return Response.json({ data: workflow.output });
  }

  if (path === "/v1/workflows/chat/generate") return Response.json({ data: (await runChatWorkflow(body as never)).output });
  if (path === "/v1/workflows/blog/generate") return Response.json({ data: (await runBlogWorkflow(body as never)).output });
  if (path === "/v1/workflows/presentation/generate") return Response.json({ data: (await runPresentationWorkflow(body as never)).output });
  if (path === "/v1/workflows/image/generate") return Response.json({ data: (await runImageWorkflow(body as never)).output });
  if (path === "/v1/workflows/email/generate") return Response.json({ data: (await runEmailWorkflow(body as never)).output });
  if (path === "/v1/workflows/knowledge/generate") return Response.json({ data: (await runKnowledgeWorkflow(body as never)).output });
  if (path === "/v1/google/drive/save-generated-file") return Response.json({ data: await saveGeneratedFileToDrive() });
  if (path === "/v1/admin/summary") {
    return Response.json({
      data: {
        users: 0,
        usageLogs: 0,
        generatedFiles: 0,
        auditLogs: 0,
        dailyUsageLimitPlaceholder: "Configure database-backed usage limits in the API service.",
        monthlyUsageLimitPlaceholder: "Configure database-backed usage limits in the API service."
      }
    });
  }
  if (path === "/v1/admin/users") return Response.json({ data: [] });
  if (path === "/v1/admin/allowlist") return Response.json({ data: body });

  return Response.json({ error: "Unknown local workflow" }, { status: 404 });
}
