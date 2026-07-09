# Markitome AI Notetaker

Internal AI meeting notetaker for Markitome Private Limited.

- Primary domain: `notetaker.markitome.ai`
- Target cloud: Cloudflare
- Runtime: Cloudflare Workers
- Database: Cloudflare D1 with Drizzle schema and migrations
- Object storage: Cloudflare R2 for recordings and transcripts
- Queues: Cloudflare Queues for transcription and Claude note generation
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
- `SCREENAPP_BOT_API_URL`
- `SCREENAPP_BOT_API_TOKEN`
- `VEXA_API_URL`
- `VEXA_API_KEY`
- `MEETINGBOT_API_URL`
- `MEETINGBOT_API_KEY`
- `WEBHOOK_SECRET`

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
npx wrangler secret put SCREENAPP_BOT_API_URL
npx wrangler secret put SCREENAPP_BOT_API_TOKEN
npx wrangler secret put VEXA_API_URL
npx wrangler secret put VEXA_API_KEY
npx wrangler secret put MEETINGBOT_API_URL
npx wrangler secret put MEETINGBOT_API_KEY
npx wrangler secret put WEBHOOK_SECRET
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

The app does not implement silent recording.

Consent statuses:

- `not_required`
- `pending`
- `confirmed`
- `rejected`
- `unknown`

Controls:

- Bot recording cannot start unless `consent_status = confirmed`.
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

## Bot Integration Notes

Required provider files:

- `src/server/bots/BotProvider.ts`
- `src/server/bots/GoogleMeetBotProvider.ts`
- `src/server/bots/ZoomBotProvider.ts`
- `src/server/bots/TeamsBotProvider.ts`
- `src/server/bots/ScreenAppMeetingBotProvider.ts`
- `src/server/bots/VexaBotProvider.ts`
- `src/server/bots/BotSessionService.ts`

The bot display name is:

```text
Markitome AI Notetaker - Recording
```

Meeting bot joining prefers the free MIT-licensed `screenappai/meeting-bot` service when configured. It is a Dockerized open-source Playwright bot that joins and records Google Meet, Microsoft Teams, and Zoom meetings. It cannot run inside a Cloudflare Worker because the bot needs a real browser/container process, virtual display, and media capture.

Required Markitome configuration for `screenappai/meeting-bot`:

- `SCREENAPP_BOT_API_URL`: base URL of your self-hosted bot service.
- `SCREENAPP_BOT_API_TOKEN`: token passed to the bot service as `bearerToken`.
- `WEBHOOK_SECRET`: used for Markitome webhook verification and ScreenApp HMAC signing.

Markitome sends bot creation requests to:

```text
POST {SCREENAPP_BOT_API_URL}/google/join
POST {SCREENAPP_BOT_API_URL}/microsoft/join
POST {SCREENAPP_BOT_API_URL}/zoom/join
```

Configure `screenappai/meeting-bot` webhook environment variables:

```text
NOTIFY_WEBHOOK_ENABLED=true
NOTIFY_WEBHOOK_URL=https://notetaker.markitome.ai/api/public/bots/screenapp/webhook
NOTIFY_WEBHOOK_SECRET={WEBHOOK_SECRET}
```

Google Meet event imports are scheduled locally by the Cloudflare Worker cron trigger and sent to the bot shortly before the meeting starts. Hosts may still need to admit the bot from the waiting room. For Google Meet calls that require sign-in, run ScreenApp's Chrome sidecar with a signed-in Google profile as documented by that project.

Self-hosted Vexa and MeetingBot remain optional open-source fallbacks, but do not use hosted Vexa if the requirement is free/open-source only.

Required Markitome configuration after self-hosting MeetingBot:

- `MEETINGBOT_API_URL`: base URL of your deployed MeetingBot server, for example `https://bots.example.com`
- `MEETINGBOT_API_KEY`: API key generated in the MeetingBot dashboard
- `WEBHOOK_SECRET`: used in the Markitome callback URL sent to MeetingBot

Markitome sends Google Meet bot creation requests to:

```text
POST {MEETINGBOT_API_URL}/api/bots
```

with the `x-api-key` header and a callback URL:

```text
https://notetaker.markitome.ai/api/public/bots/meetingbot/webhook?token={WEBHOOK_SECRET}
```

Real meeting bot joining may require Google, Zoom, and Microsoft OAuth/app approval, recording policy compliance, host admission, and tenant-level permissions.

## Screen Recording Fallback

The `/screen-recording` page uses:

- `navigator.mediaDevices.getDisplayMedia`
- `MediaRecorder`
- Optional microphone capture through `getUserMedia`
- Timer
- Pause/resume
- Stop
- Upload to R2 through the same upload and queue pipeline

Users must confirm consent before recording starts.

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
