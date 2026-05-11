# Markitome AI

Production-ready foundation for the internal Markitome AI workspace.

- App: `https://app.markitome.ai`
- API: `https://api.markitome.ai`
- Domain: `markitome.ai`

## What is included

- Monorepo with `apps/web`, `apps/api`, `apps/worker`, and shared packages.
- Next.js + TypeScript + Tailwind frontend with Google login, protected app shell, dashboard, module pages, admin placeholder, and Proposal Builder.
- Hono Node API with health check, protected route, role middleware, proposal generation route, AI orchestration, usage/audit placeholders.
- Working backend-backed forms for Chat, Proposal Builder, Blog Writer, Presentation Builder, Image Studio, Email Assistant, and Knowledge Base.
- Admin screen for user summaries, usage/audit counts, and external email allowlisting.
- Prisma schema for users, roles, allowlist, conversations, workflows, generated files, Google Drive files, client/proposal/blog/presentation/image records, knowledge documents, AI usage logs, and audit logs.
- Placeholder integrations for Cloudflare Workers AI, R2, Vectorize, Google Drive, Google Docs, Google Slides, Gmail, Sentry, and PostHog.

## Security rules

Never put credentials in source code or chat. Configure sensitive values through local `.env` files ignored by Git, Render environment variables, Cloudflare secrets, or GitHub secrets.

The repository includes `.env.example` with placeholder names only. Real `.env` files are ignored by Git.

## Local setup

```bash
corepack enable
pnpm install
cp .env.example .env
pnpm db:generate
pnpm db:migrate
pnpm --filter @markitome/db prisma:seed
pnpm dev
```

Frontend runs at `http://localhost:3000`. API runs at `http://localhost:4000`.

## Google OAuth

Create a GCP OAuth web client and configure redirect URI:

```text
http://localhost:3000/api/auth/callback/google
https://app.markitome.ai/api/auth/callback/google
```

Required OAuth scopes for the first milestone:

```text
openid
email
profile
```

Future Google automation scopes should be requested only when needed:

```text
https://www.googleapis.com/auth/drive.file
https://www.googleapis.com/auth/documents
https://www.googleapis.com/auth/presentations
https://www.googleapis.com/auth/gmail.compose
```

## Access policy

Initial login is restricted to `@markitome.com` emails and emails present in `approved_email_allowlist`.
RBAC roles are modeled as `ADMIN`, `MANAGER`, `TEAM_MEMBER`, and `INTERN`.

Set `INITIAL_ADMIN_EMAIL` before first login to bootstrap the first admin user. Keep this as an environment variable, not source code.

## Deployment notes

See:

- [Render deployment notes](docs/render.md)
- [Cloudflare setup notes](docs/cloudflare.md)
- [GCP OAuth setup notes](docs/gcp-oauth.md)
- [Architecture notes](docs/architecture.md)
- [Module notes](docs/modules.md)
- [Launch checklist](docs/launch-checklist.md)
- [Manual QA checklist](docs/manual-qa.md)

## First milestone status

This foundation intentionally uses placeholders for external calls where credentials, API scopes, service accounts, and production policies are required.

The Prisma migrations directory is present at `packages/db/prisma/migrations`; run `pnpm db:migrate` after configuring `DATABASE_URL` to create the first migration locally.

## Current launch posture

The app is deployable as a Cloudflare OpenNext Worker with Google OAuth, protected pages, Workers AI binding support, R2, Vectorize, and D1 resource bindings. For full database persistence and production admin workflows, deploy `apps/api` to Render with PostgreSQL and set `API_BASE_URL` on the web app.
