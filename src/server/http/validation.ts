import type { Context } from "hono";
import type { z } from "zod";
import { ApiError } from "./errors";

export async function parseJson<T extends z.ZodTypeAny>(c: Context, schema: T): Promise<z.infer<T>> {
  let input: unknown;
  try {
    input = await c.req.json();
  } catch {
    throw new ApiError(400, "invalid_json", "Request body must be valid JSON.");
  }
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ApiError(400, "validation_error", "Request validation failed.", result.error.flatten());
  }
  return result.data;
}

export function parseQuery<T extends z.ZodTypeAny>(c: Context, schema: T): z.infer<T> {
  const result = schema.safeParse(c.req.query());
  if (!result.success) {
    throw new ApiError(400, "validation_error", "Query validation failed.", result.error.flatten());
  }
  return result.data;
}
