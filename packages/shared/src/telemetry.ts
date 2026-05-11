export function initMonitoring() {
  return {
    sentryConfigured: Boolean(process.env.SENTRY_DSN),
    posthogConfigured: Boolean(process.env.POSTHOG_KEY),
    TODO: "Initialize Sentry and PostHog here without logging secrets or exposing server-only values."
  };
}
