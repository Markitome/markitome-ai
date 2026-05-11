import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { healthRoutes } from "./routes/health";
import { proposalRoutes } from "./routes/proposals";
import { protectedRoutes } from "./routes/protected";
import { workflowRoutes } from "./routes/workflows";
import { googleRoutes } from "./routes/google";
import { adminRoutes } from "./routes/admin";

const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: [process.env.APP_BASE_URL ?? "http://localhost:3000"],
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    credentials: true
  })
);

app.route("/health", healthRoutes);
app.route("/v1", protectedRoutes);
app.route("/v1/proposals", proposalRoutes);
app.route("/v1/workflows", workflowRoutes);
app.route("/v1/google", googleRoutes);
app.route("/v1/admin", adminRoutes);

const port = Number(process.env.PORT ?? 4000);

serve({ fetch: app.fetch, port }, () => {
  console.log(`Markitome API listening on port ${port}`);
});
