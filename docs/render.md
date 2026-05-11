# Render Deployment Notes

## Services

Create these Render resources:

- PostgreSQL database for `DATABASE_URL`.
- Web service for `apps/api`.
- Web service for `apps/web`, or deploy the web app to a Next.js host and point it at `https://api.markitome.ai`.

## API service

Build command:

```bash
corepack enable && pnpm install --frozen-lockfile && pnpm --filter @markitome/db prisma:generate && pnpm --filter @markitome/api build
```

Start command:

```bash
pnpm --filter @markitome/api start
```

Add environment variables from `.env.example` in Render. Do not paste secrets into code.

## Database migrations

Run migrations from a trusted environment:

```bash
pnpm db:migrate
```
