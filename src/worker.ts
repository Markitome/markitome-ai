import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import type { AppVariables, Env } from "./types";
import { renderPage } from "./client/pages";
import { loadUser } from "./server/auth/rbac";
import { authRoutes } from "./server/auth/googleOAuth";
import { sessionCookieName, verifySessionToken } from "./server/auth/session";
import { errorBoundary } from "./server/http/errors";
import { apiRoutes } from "./server/routes/api";
import { handleQueueBatch, type QueueJob } from "./server/queues/jobs";

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

app.use("*", errorBoundary);

app.get("/health", (c) =>
  c.json({
    ok: true,
    service: "markitome-ai-notetaker",
    environment: c.env.APP_ENV,
    timestamp: new Date().toISOString()
  })
);

app.route("/api/auth", authRoutes);
app.route("/api", apiRoutes);

app.get("*", async (c) => {
  const user = await getOptionalUser(c.env, getCookie(c, sessionCookieName));
  const path = new URL(c.req.url).pathname;
  return c.html(renderPage({ user, path }));
});

async function getOptionalUser(env: Env, cookie: string | undefined) {
  const payload = await verifySessionToken(env, cookie);
  if (!payload) return null;
  return loadUser(env, payload.userId);
}

export default {
  fetch: app.fetch,
  queue: handleQueueBatch as ExportedHandler<Env, QueueJob>["queue"]
};
