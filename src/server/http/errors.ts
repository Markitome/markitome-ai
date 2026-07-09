import type { Context, Next } from "hono";
import type { Env, StructuredError } from "../../types";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
  }
}

export function jsonError(c: Context<{ Bindings: Env }>, error: ApiError): Response {
  const body: StructuredError = {
    error: {
      code: error.code,
      message: error.message,
      details: error.details
    }
  };
  return c.json(body, error.status as never);
}

export async function errorBoundary(c: Context<{ Bindings: Env }>, next: Next): Promise<Response | void> {
  try {
    await next();
  } catch (error) {
    if (error instanceof ApiError) return jsonError(c, error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonError(c, new ApiError(500, "internal_error", message));
  }
}
