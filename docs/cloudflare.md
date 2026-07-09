# Cloudflare Setup Notes

Configure these in Cloudflare, then store secrets as Worker secrets or deployment environment variables:

- Google SSO: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, and `INITIAL_ADMIN_EMAIL`.
- OpenAI text chat and structured workflows: `OPENAI_API_KEY`; optional `OPENAI_TEXT_MODEL`.
- Claude text chat: `ANTHROPIC_API_KEY`; optional `ANTHROPIC_TEXT_MODEL`, `ANTHROPIC_VERSION`, and `ANTHROPIC_MAX_TOKENS`.
- Nano Banana image generation: `GEMINI_API_KEY`; optional `NANO_BANANA_IMAGE_MODEL`.
- Seedance 2.0 video generation through fal: `FAL_KEY`; optional `SEEDANCE_ENDPOINT`, `SEEDANCE_DEFAULT_DURATION`, `SEEDANCE_DEFAULT_RESOLUTION`, `SEEDANCE_DEFAULT_ASPECT_RATIO`, and `SEEDANCE_POLL_SECONDS`.
- Existing Cloudflare services: Workers AI account access for `CLOUDFLARE_TEXT_MODEL`, R2 bucket named by `CLOUDFLARE_R2_BUCKET`, Vectorize index named by `CLOUDFLARE_VECTORIZE_INDEX`, and optional AI Gateway ID in `CLOUDFLARE_AI_GATEWAY_ID`.

Required variables and safe defaults are listed in `.env.example`. Never expose provider API tokens to the frontend.
