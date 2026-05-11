# GCP OAuth Setup Notes

Create a Google OAuth web client for Markitome AI.

Authorized JavaScript origins:

```text
http://localhost:3000
https://app.markitome.ai
```

Authorized redirect URIs:

```text
http://localhost:3000/api/auth/callback/google
https://app.markitome.ai/api/auth/callback/google
```

Add only the scopes required by the current feature. Store `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as environment variables.
