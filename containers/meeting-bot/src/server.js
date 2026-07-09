import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { basename } from "node:path";
import { chromium } from "playwright-core";
import { z } from "zod";

const port = Number(process.env.PORT || 8080);
const chromePath = process.env.CHROME_PATH || "/usr/bin/chromium";
const sessions = new Map();

const joinSchema = z.object({
  botSessionId: z.string().min(1),
  platform: z.enum(["google_meet", "zoom", "microsoft_teams"]),
  meetingUrl: z.string().url(),
  displayName: z.string().min(1),
  uploadUrl: z.string().url(),
  completeUrl: z.string().url(),
  statusCallbackUrl: z.string().url().optional(),
  maxDurationSeconds: z.number().int().min(60).max(8 * 60 * 60).default(2 * 60 * 60)
});

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (req.method === "GET" && url.pathname === "/health") return sendJson(res, 200, { ok: true });
    if (req.method === "POST" && url.pathname === "/join") return handleJoin(req, res);
    if (req.method === "GET" && url.pathname.startsWith("/sessions/")) {
      const id = basename(url.pathname);
      return sendJson(res, 200, sessions.get(id)?.publicStatus() || { id, status: "not_found" });
    }
    if (req.method === "POST" && url.pathname.startsWith("/sessions/") && url.pathname.endsWith("/stop")) {
      const id = url.pathname.split("/")[2];
      await stopSession(id);
      return sendJson(res, 200, { ok: true, id });
    }
    return sendJson(res, 404, { error: "not_found" });
  } catch (error) {
    return sendJson(res, 500, { error: "internal_error", message: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(port, () => console.log(`meeting bot container listening on ${port}`));

async function handleJoin(req, res) {
  const payload = joinSchema.parse(await readJson(req));
  if (sessions.has(payload.botSessionId)) {
    return sendJson(res, 202, sessions.get(payload.botSessionId).publicStatus());
  }

  const state = createSessionState(payload);
  sessions.set(payload.botSessionId, state);
  runBot(payload, state).catch((error) => {
    state.status = "failed";
    state.error = error instanceof Error ? error.message : String(error);
    console.error("bot session failed", payload.botSessionId, state.error);
  });

  return sendJson(res, 202, state.publicStatus());
}

function createSessionState(payload) {
  return {
    id: payload.botSessionId,
    platform: payload.platform,
    status: "starting",
    startedAt: new Date().toISOString(),
    stopped: false,
    error: null,
    browser: null,
    recorder: null,
    publicStatus() {
      return {
        id: this.id,
        platform: this.platform,
        status: this.status,
        started_at: this.startedAt,
        error_message: this.error
      };
    }
  };
}

async function runBot(payload, state) {
  const outputPath = `/tmp/${payload.botSessionId}.webm`;
  state.status = "launching_browser";
  state.browser = await chromium.launch({
    executablePath: chromePath,
    headless: false,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--autoplay-policy=no-user-gesture-required",
      "--use-fake-ui-for-media-stream",
      "--window-size=1280,720"
    ]
  });

  const context = await state.browser.newContext({
    viewport: { width: 1280, height: 720 },
    permissions: ["microphone", "camera"]
  });
  const page = await context.newPage();

  state.status = "joining";
  await page.goto(payload.meetingUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(4_000);

  if (payload.platform === "google_meet") await joinGoogleMeet(page, payload.displayName);
  if (payload.platform === "zoom") await joinZoom(page, payload.displayName);
  if (payload.platform === "microsoft_teams") await joinTeams(page, payload.displayName);

  state.status = "recording";
  state.recorder = startRecorder(outputPath);
  await notify(payload.statusCallbackUrl, { status: "recording" });

  const deadline = Date.now() + payload.maxDurationSeconds * 1000;
  while (!state.stopped && Date.now() < deadline) {
    await page.waitForTimeout(5_000);
    if (await looksDisconnected(page)) break;
  }

  state.status = "uploading";
  await stopRecorder(state.recorder);
  await context.close().catch(() => undefined);
  await state.browser.close().catch(() => undefined);

  const file = await fs.readFile(outputPath);
  const uploadResponse = await fetch(payload.uploadUrl, {
    method: "PUT",
    headers: { "content-type": "video/webm" },
    body: file
  });
  if (!uploadResponse.ok) throw new Error(`Worker upload failed with ${uploadResponse.status}: ${await uploadResponse.text()}`);

  const completeResponse = await fetch(payload.completeUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ bot_session_id: payload.botSessionId })
  });
  if (!completeResponse.ok) throw new Error(`Worker complete failed with ${completeResponse.status}: ${await completeResponse.text()}`);

  await fs.unlink(outputPath).catch(() => undefined);
  state.status = "completed";
  await notify(payload.statusCallbackUrl, { status: "completed" });
}

async function joinGoogleMeet(page, displayName) {
  await fillPossible(page, [
    'input[aria-label*="name" i]',
    'input[placeholder*="name" i]',
    'input[type="text"]'
  ], displayName);
  await clickPossible(page, [/Got it/i, /Continue/i, /Dismiss/i]);
  await clickPossible(page, [/Turn off microphone/i, /Microphone/i], 1500);
  await clickPossible(page, [/Turn off camera/i, /Camera/i], 1500);
  await clickPossible(page, [/Ask to join/i, /Join now/i, /Join meeting/i], 30_000);
}

async function joinZoom(page, displayName) {
  await clickPossible(page, [/Join from Your Browser/i, /Launch Meeting/i, /Cancel/i], 12_000);
  await fillPossible(page, [
    'input[id*="name" i]',
    'input[placeholder*="name" i]',
    'input[type="text"]'
  ], displayName);
  await clickPossible(page, [/Join Audio by Computer/i, /Join with Computer Audio/i], 2000);
  await clickPossible(page, [/Join/i, /I Agree/i], 30_000);
}

async function joinTeams(page, displayName) {
  await clickPossible(page, [/Continue on this browser/i, /Join on the web/i, /Use web app instead/i], 20_000);
  await fillPossible(page, [
    'input[placeholder*="name" i]',
    'input[aria-label*="name" i]',
    'input[type="text"]'
  ], displayName);
  await clickPossible(page, [/Join now/i, /Ask to join/i], 30_000);
}

async function fillPossible(page, selectors, value) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) > 0) {
      await locator.fill(value, { timeout: 3000 }).catch(() => undefined);
      return;
    }
  }
}

async function clickPossible(page, patterns, timeout = 5000) {
  const expires = Date.now() + timeout;
  while (Date.now() < expires) {
    for (const pattern of patterns) {
      const locator = page.getByText(pattern).first();
      if ((await locator.count()) > 0) {
        await locator.click({ timeout: 1500 }).catch(() => undefined);
        return true;
      }
      const button = page.getByRole("button", { name: pattern }).first();
      if ((await button.count()) > 0) {
        await button.click({ timeout: 1500 }).catch(() => undefined);
        return true;
      }
    }
    await page.waitForTimeout(500);
  }
  return false;
}

async function looksDisconnected(page) {
  const text = await page.locator("body").innerText({ timeout: 1000 }).catch(() => "");
  return /meeting ended|removed from|left the meeting|call ended|rejoin/i.test(text);
}

function startRecorder(outputPath) {
  const args = [
    "-y",
    "-f", "x11grab",
    "-video_size", "1280x720",
    "-framerate", "15",
    "-i", `${process.env.DISPLAY || ":99"}.0`,
    "-f", "pulse",
    "-i", "meetingbot.monitor",
    "-c:v", "libvpx-vp9",
    "-b:v", "1200k",
    "-c:a", "libopus",
    "-b:a", "96k",
    outputPath
  ];
  return spawn("ffmpeg", args, { stdio: ["pipe", "ignore", "pipe"] });
}

async function stopRecorder(recorder) {
  if (!recorder) return;
  if (recorder.exitCode !== null) return;
  recorder.stdin.write("q");
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      recorder.kill("SIGTERM");
      resolve();
    }, 8000);
    recorder.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function stopSession(id) {
  const state = sessions.get(id);
  if (!state) return;
  state.stopped = true;
  state.status = "stopping";
  await stopRecorder(state.recorder);
  await state.browser?.close().catch(() => undefined);
}

async function notify(url, payload) {
  if (!url) return;
  await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  }).catch(() => undefined);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}
