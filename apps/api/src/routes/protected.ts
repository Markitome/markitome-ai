import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";

export const protectedRoutes = new Hono();

protectedRoutes.get("/me", requireAuth, (c) => {
  const user = c.get("user");
  return c.json({ data: user });
});
