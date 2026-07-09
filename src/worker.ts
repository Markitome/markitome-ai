import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import type { AppVariables, Env } from "./types";
import { renderPage } from "./client/pages";
import { loadUser } from "./server/auth/rbac";
import { authRoutes } from "./server/auth/googleOAuth";
import { sessionCookieName, verifySessionToken } from "./server/auth/session";
import { errorBoundary, handleError } from "./server/http/errors";
import { apiRoutes } from "./server/routes/api";
import { handleQueueBatch, type QueueJob } from "./server/queues/jobs";
import { BotSessionService } from "./server/bots/BotSessionService";

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

app.use("*", errorBoundary);
app.onError((error, c) => handleError(c, error));

app.get("/health", (c) =>
  c.json({
    ok: true,
    service: "markitome-ai-notetaker",
    environment: c.env.APP_ENV,
    timestamp: new Date().toISOString()
  })
);

app.post("/api/public/bots/meetingbot/webhook", async (c) => {
  const token = c.req.query("token") ?? c.req.header("x-webhook-secret");
  if (c.env.WEBHOOK_SECRET && token !== c.env.WEBHOOK_SECRET) {
    return c.json({ error: { code: "invalid_webhook_secret", message: "Webhook secret is invalid." } }, 403);
  }
  const botSession = await new BotSessionService(c.env).handleMeetingBotWebhook(await c.req.json());
  return c.json({ ok: true, bot_session: botSession });
});

app.post("/api/public/bots/vexa/webhook", async (c) => {
  const authorization = c.req.header("authorization");
  const token = c.req.query("token") ?? c.req.header("x-webhook-secret");
  if (
    c.env.WEBHOOK_SECRET &&
    token !== c.env.WEBHOOK_SECRET &&
    authorization !== `Bearer ${c.env.WEBHOOK_SECRET}`
  ) {
    return c.json({ error: { code: "invalid_webhook_secret", message: "Webhook secret is invalid." } }, 403);
  }
  const botSession = await new BotSessionService(c.env).handleVexaWebhook(await c.req.json());
  return c.json({ ok: true, bot_session: botSession });
});

app.post("/api/public/bots/screenapp/webhook", async (c) => {
  const bodyText = await c.req.text();
  const token = c.req.query("token") ?? c.req.header("x-webhook-secret");
  const signature = c.req.header("x-webhook-signature");
  if (c.env.WEBHOOK_SECRET) {
    const validToken = token === c.env.WEBHOOK_SECRET;
    const validSignature = signature ? await verifyHmacSha256(bodyText, c.env.WEBHOOK_SECRET, signature) : false;
    if (!validToken && !validSignature) {
      return c.json({ error: { code: "invalid_webhook_secret", message: "Webhook secret is invalid." } }, 403);
    }
  }
  const botSession = await new BotSessionService(c.env).handleScreenAppWebhook(JSON.parse(bodyText));
  return c.json({ ok: true, bot_session: botSession });
});

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

async function verifyHmacSha256(body: string, secret: string, signature: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const expected = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return timingSafeEqual(expected, signature);
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

export default {
  fetch: app.fetch,
  queue: handleQueueBatch as ExportedHandler<Env, QueueJob>["queue"],
  async scheduled(_event: ScheduledEvent, env: Env) {
    await new BotSessionService(env).runDueScheduledBots();
  }
};
