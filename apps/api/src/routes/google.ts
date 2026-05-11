import { saveGeneratedFileToDrive } from "@markitome/google";
import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { logAudit } from "../services/logging";

export const googleRoutes = new Hono();

googleRoutes.post("/drive/save-generated-file", requireAuth, async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const result = await saveGeneratedFileToDrive();
  await logAudit(user, "google_drive_file", "SAVE_TO_DRIVE", {
    title: body.title ?? "Untitled generated file",
    placeholder: true
  });

  return c.json({ data: result });
});
