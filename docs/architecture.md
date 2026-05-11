# Markitome AI Architecture

## Runtime Boundaries

- `apps/web`: Next.js app at `https://app.markitome.ai`.
- `apps/api`: Hono API at `https://api.markitome.ai`.
- `apps/worker`: Cloudflare Worker placeholder for background ingestion, R2 processing, and Vectorize indexing.
- `packages/db`: Prisma schema and client.
- `packages/ai`: backend-only Cloudflare Workers AI adapter and model router.
- `packages/google`: backend-only Google Drive, Docs, Slides, and Gmail service placeholders.
- `packages/storage`: backend-only Cloudflare R2 helpers.

## Request Flow

1. User signs in with Google OAuth through NextAuth.
2. NextAuth restricts access to `@markitome.com` or allowlisted external emails.
3. Frontend module forms call same-origin Next API routes.
4. Next API routes mint short-lived internal JWTs using `NEXTAUTH_SECRET`.
5. Hono API verifies the internal token, checks role middleware where needed, and runs workflows.
6. AI, Google, R2, and Vectorize calls stay server-side.
7. Usage and audit events are written to PostgreSQL when the database is reachable.

## Security Notes

- Do not add `NEXT_PUBLIC_` variables for secrets.
- Do not log provider tokens, OAuth secrets, service account private keys, or user credentials.
- Keep `.env` files local and ignored by Git.
- Put production secrets in Render environment variables, Cloudflare secrets, GitHub secrets, or local ignored `.env` files.

## Production TODOs

- Finalize Sentry and PostHog initialization.
- Add rate limiting and per-role usage enforcement.
- Add CSRF review for state-changing admin endpoints.
- Add Google OAuth incremental scope consent for Drive, Docs, Slides, and Gmail compose.
- Add real R2 upload/download and Vectorize indexing.
- Add CI with typecheck, lint, Prisma validation, and build jobs.
