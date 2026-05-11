# Cloudflare Setup Notes

Configure these in Cloudflare, then store secrets in environment variables:

- Workers AI account access for `@cf/google/gemma-4-26b-a4b-it`.
- R2 bucket named by `CLOUDFLARE_R2_BUCKET`.
- Vectorize index named by `CLOUDFLARE_VECTORIZE_INDEX`.
- Optional AI Gateway ID in `CLOUDFLARE_AI_GATEWAY_ID`.

Required variables are listed in `.env.example`. Never expose Cloudflare API tokens to the frontend.
