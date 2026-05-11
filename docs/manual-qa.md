# Manual QA Checklist

Run this checklist before inviting the full team.

- Login: sign in with a `@markitome.com` Google account and confirm `/dashboard` loads.
- Role restriction: open `/admin` as an admin, then confirm non-admin accounts cannot access admin actions after roles are configured.
- Chat: submit a message and verify a structured response with suggested actions.
- Proposal Builder: generate a proposal, confirm all sections render, and test the Google Drive save placeholder.
- Blog Writer: generate a blog and verify SEO metadata, outline, article, FAQs, and internal linking suggestions.
- Presentation Builder: generate slides and verify slide titles, content, notes, suggested visuals, and CTA slide.
- Image Studio: generate an image brief and verify prompt, caption options, designer notes, and clear image-model fallback if no image model is configured.
- Email Assistant: generate email output and verify subject, body, follow-up email, and WhatsApp message.
- Knowledge Base: submit a document summary and verify ingestion metadata, vector ID placeholder, and search preview.
- Admin Panel: confirm users, usage logs, generated files, conversations, records, knowledge documents, and audit log views load.
- Health: confirm `https://api.markitome.ai/health` returns `ok: true`.
- Security: confirm no secret values appear in logs, frontend source, API responses, or committed files.
