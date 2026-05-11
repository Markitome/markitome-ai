# Launch Checklist

## Live URLs

- App: `https://app.markitome.ai`
- API health: `https://api.markitome.ai/health`
- Repository: `https://github.com/Markitome/markitome-ai`

## Required environment variables

Configure sensitive values only in Cloudflare secrets, Render environment variables, GitHub secrets, or ignored local `.env` files.

- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `GOOGLE_DRIVE_ROOT_FOLDER_ID`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_AI_GATEWAY_ID`
- `CLOUDFLARE_R2_ACCESS_KEY_ID`
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
- `CLOUDFLARE_R2_BUCKET`
- `CLOUDFLARE_VECTORIZE_INDEX`
- `SENTRY_DSN`
- `POSTHOG_KEY`

## Frontend deployment

Build and deploy the Cloudflare OpenNext Worker from `apps/web`.

```bash
pnpm --filter @markitome/web cf:build
pnpm --filter @markitome/web cf:deploy
```

Confirm bindings exist for Workers AI, R2, Vectorize, and the database resource used by the deployment target.

## Backend deployment

Deploy `apps/api` to Render for PostgreSQL-backed persistence, audit logs, usage logs, RBAC administration, and generated record storage.

```bash
pnpm --filter @markitome/db prisma:generate
pnpm --filter @markitome/api build
pnpm --filter @markitome/api start
```

Set `API_BASE_URL=https://api.markitome.ai` on the web app after the Render service is live and mapped to the API domain.

## Database migrations

Run migrations only after `DATABASE_URL` points to the intended Render PostgreSQL database.

```bash
pnpm db:migrate
pnpm --filter @markitome/db prisma:seed
```

## Team invites

- Markitome users with `@markitome.com` can sign in by Google OAuth.
- External users must be added to the approved email allowlist.
- Admins can change user roles after the database-backed API is configured.

## Known limitations for launch

- Google Drive, Docs, Slides, and Gmail adapters are present but require final OAuth scopes and service configuration before creating real files.
- Image generation has an adapter and user-safe fallback until an approved Cloudflare image model is configured.
- Full PostgreSQL persistence requires the Render API deployment and `API_BASE_URL`.
- Knowledge Base ingestion has the product route and prompt flow; production extraction, embeddings, and Vectorize writes need final provider credentials and policy decisions.
