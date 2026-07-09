# Markitome AI Notetaker

Internal AI meeting notetaker for Markitome Private Limited.

- Primary domain: `notetaker.markitome.ai`
- Target cloud: Cloudflare
- Runtime: Cloudflare Workers
- Database: Cloudflare D1 with Drizzle schema and migrations
- Object storage: Cloudflare R2 for recordings and transcripts
- Queues: Cloudflare Queues for transcription and Claude note generation
- Meeting bot runtime: Cloudflare Containers running Chromium, PulseAudio, and FFmpeg
- Search: D1 keyword search, with Vectorize binding prepared for semantic search

## Architecture

The Worker in `src/worker.ts` serves the React-rendered internal UI, Google OAuth routes, JSON API routes, and queue consumers.

Core flow:

1. User uploads a recording or records their screen in the browser.
2. The app writes the media object to R2 through an app-scoped signed upload URL.
3. D1 stores meeting, recording, consent, and processing metadata.
4. `TRANSCRIPTION_QUEUE` receives a transcription job.
5. A transcription provider writes transcript text to the `TRANSCRIPTS` R2 bucket.
6. `AI_NOTES_QUEUE` calls Claude through `@anthropic-ai/sdk`.
7. Structured notes, action items, decisions, topics, token usage, raw model output, and rendered Markdown are stored in D1.

Meeting bot flow:

1. A user imports or creates a Google Meet, Zoom, or Microsoft Teams meeting note.
2. The meeting owner or an admin confirms recording consent and starts the bot.
3. The Worker creates a `bot_sessions` row and a one-time signed R2 upload session.
4. A Cloudflare Container opens the meeting URL in Chromium as `Markitome AI Notetaker - Recording`.
5. The container records the visible browser session with FFmpeg and uploads the WebM back to the Worker.
6. The Worker creates the recording row and sends it through the same transcription and Claude notes queues.

Production bot joining may still require host admission, Google/Zoom/Microsoft app approval, tenant-level policies, meeting SDK/browser policy compliance, and recording-consent compliance.

Claude is used only for reasoning and note generation. It is not used as the primary speech-to-text engine. The STT layer is behind `TranscriptionProvider` so Cloudflare Workers AI, Whisper-compatible APIs, or another provider can be added without changing meeting or notes logic.

## Cloudflare Resources

Run these once in the target Cloudflare account:

```bash
npx wrangler login
npx wrangler d1 create markitome-notetaker-db
npx wrangler r2 bucket create markitome-notetaker-recordings
npx wrangler r2 bucket create markitome-notetaker-transcripts
npx wrangler queues create notetaker-transcription-queue
npx wrangler queues create notetaker-ai-notes-queue
npx wrangler queues create notetaker-email-notification-queue
npx wrangler vectorize create notetaker-meeting-search --dimensions=1024 --metric=cosine
```

Update `wrangler.toml` with the real D1 `database_id`. Do not hardcode account IDs or secrets.

Cloudflare Containers are required for the meeting bot. Wrangler builds `containers/meeting-bot/Dockerfile` during deployment, so Docker or a Docker-compatible CLI is required wherever `wrangler deploy` runs.

## Environment Variables

Configured in `wrangler.toml`:

- `APP_ENV`
- `APP_NAME`
- `APP_DOMAIN`
- `ALLOWED_EMAIL_DOMAIN`
- `CLAUDE_MODEL`

Required secrets:

- `ANTHROPIC_API_KEY`
- `SESSION_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `MICROSOFT_TENANT_ID`
- `ZOOM_CLIENT_ID`
- `ZOOM_CLIENT_SECRET`
- `ZOOM_ACCOUNT_ID`

Set them with:

```bash
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put SESSION_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put MICROSOFT_CLIENT_ID
npx wrangler secret put MICROSOFT_CLIENT_SECRET
npx wrangler secret put MICROSOFT_TENANT_ID
npx wrangler secret put ZOOM_CLIENT_ID
npx wrangler secret put ZOOM_CLIENT_SECRET
npx wrangler secret put ZOOM_ACCOUNT_ID
```

## Local Development

```bash
npm install
npx drizzle-kit generate
npx wrangler d1 migrations apply markitome-notetaker-db --local
npx wrangler d1 execute markitome-notetaker-db --local --file=drizzle/seed-super-admin.sql
npx wrangler dev
npm run typecheck
npm run lint
```

Local container development additionally requires Docker:

```bash
docker build -t markitome-meeting-bot ./containers/meeting-bot
docker run --rm -p 8080:8080 markitome-meeting-bot
curl http://localhost:8080/health
```

The local Worker serves:

- UI: `http://localhost:8787`
- Health: `http://localhost:8787/health`
- API: `http://localhost:8787/api/*`

## Production Deployment

```bash
npx wrangler d1 migrations apply markitome-notetaker-db --remote
npx wrangler deploy
curl https://notetaker.markitome.ai/health
```

## GitHub Actions

`.github/workflows/deploy.yml` deploys on pushes to `main`.

It also supports `workflow_dispatch` and the `feature/cloudflare-ai-notetaker` branch while the bot rollout is being tested.

Required GitHub secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Workflow steps:

- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm run test --if-present`
- `npx wrangler d1 migrations apply markitome-notetaker-db --remote`
- `npx wrangler deploy`

## RBAC

Roles:

- `super_admin`
- `admin`
- `employee`

Seeded first super admin:

- `vivek@markitome.com`

Access rules:

- Employees can access their own meetings, uploads, notes, transcripts, and meetings shared with them.
- Admins can access all company meetings, employee libraries, recordings, transcripts, AI notes, and meeting/recording audit logs.
- Super admins inherit admin access and can manage users, roles, integrations, settings, usage logs, storage usage, and audit logs.

Sensitive routes are protected with authentication and RBAC middleware. Meeting access checks enforce owner/shared/admin visibility.

## Consent And Compliance

The app does not implement silent recording. Bot recording and browser screen recording require explicit consent confirmation before starting.

Consent statuses:

- `not_required`
- `pending`
- `confirmed`
- `rejected`
- `unknown`

Controls:

- Recording cannot start unless the employee confirms consent in the browser.
- Bot recording cannot start unless consent is confirmed and the bot joins visibly as `Markitome AI Notetaker - Recording`.
- Screen recording requires a consent confirmation checkbox.
- Uploads require consent confirmation unless imported historically by an admin.
- Consent confirmations are stored with actor and timestamp where recordings are created.
- Sensitive actions write audit logs.

The super admin settings page is prepared for:

- Default consent requirement
- Retention period
- Download permissions
- Employee deletion policy
- Allowed file types
- Maximum upload size

## Cloudflare Container Meeting Bot

The bot is implemented in this repository under `containers/meeting-bot`. It does not depend on Recall.ai, Vexa, ScreenApp, or any other third-party bot API.

Supported platforms:

- Google Meet
- Zoom
- Microsoft Teams

The bot container uses:

- Chromium through Playwright
- Xvfb virtual display
- PulseAudio virtual audio sink
- FFmpeg WebM recording
- Worker-signed R2 upload URL

Important limitations:

- The host may need to admit the bot from the waiting room.
- Google, Zoom, and Teams browser UIs can change; selectors may need maintenance.
- Tenant policies can block anonymous/browser participants or recording.
- Cloudflare Workers alone cannot run this bot; Cloudflare Containers are required.

## Browser Screen Recording Fallback

The `/screen-recording` page uses:

- `navigator.mediaDevices.getDisplayMedia`
- `MediaRecorder`
- Optional microphone capture through `getUserMedia`
- Timer
- Pause/resume
- Stop
- Upload to R2 through the same upload and queue pipeline

Users must confirm consent before recording starts.

This works on the current Cloudflare setup because the browser performs media capture and the Worker handles authentication, R2 uploads, D1 metadata, Queues, transcription, Claude notes, exports, search, and audit logging.

## Uploads

Supported file types:

- `mp3`
- `wav`
- `m4a`
- `mp4`
- `mov`
- `webm`
- `mkv`

Supported source types include Google Meet, Zoom, Microsoft Teams, screen recording, phone call recording, other audio, other video, and other.

## Transcription Providers

Interface:

```ts
transcribeRecording(recording): Promise<TranscriptResult>
```

Providers:

- `CloudflareWorkersAITranscriptionProvider` placeholder
- `ExternalSTTProvider` placeholder
- `ManualTranscriptProvider`

The external and Workers AI providers intentionally do not fake transcripts. Wire a real STT service before expecting uploaded audio/video to transcribe automatically.

## Claude Notes

Claude service:

- Uses `@anthropic-ai/sdk`
- Reads `ANTHROPIC_API_KEY`
- Reads `CLAUDE_MODEL` with a fallback in code
- Retries failed requests
- Chunks long transcripts
- Summarizes chunks
- Merges context
- Requests strict JSON
- Validates output with Zod
- Attempts JSON repair
- Stores raw response, parsed JSON, rendered Markdown, model name, token usage if available, and generation timestamp

Claude instructions explicitly prohibit inventing action items or decisions.

## Exports

Meeting detail supports:

- Copy notes from rendered page output
- Download Markdown
- Download JSON
- Download transcript TXT
- Download PDF-ready HTML
- Google Docs-ready plain text

## Search

`GET /api/search?q=` searches:

- Meeting title
- Transcript preview
- AI notes JSON
- Action items
- Decisions

The `MEETING_SEARCH` Vectorize binding is configured for semantic search extension over transcript chunks and meeting summaries.
