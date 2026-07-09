import type { Context, Next } from "hono";
import type { AppVariables, Env, StructuredError } from "../../types";

type ErrorContext = Context<{ Bindings: Env; Variables: AppVariables }>;

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

export function jsonError(c: ErrorContext, error: ApiError): Response {
  const body: StructuredError = {
    error: {
      code: error.code,
      message: error.message,
      details: error.details
    }
  };
  return c.json(body, error.status as never);
}

function isApiErrorLike(error: unknown): error is ApiError {
  return (
    error instanceof ApiError ||
    (typeof error === "object" &&
      error !== null &&
      "status" in error &&
      "code" in error &&
      "message" in error &&
      typeof (error as { status: unknown }).status === "number" &&
      typeof (error as { code: unknown }).code === "string" &&
      typeof (error as { message: unknown }).message === "string")
  );
}

export function handleError(c: ErrorContext, error: unknown): Response {
  if (isApiErrorLike(error)) {
    return jsonError(c, new ApiError(error.status, error.code, error.message, error.details));
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  return jsonError(c, new ApiError(500, "internal_error", message));
}

export async function errorBoundary(c: ErrorContext, next: Next): Promise<Response | void> {
  try {
    return await next();
  } catch (error) {
    return handleError(c, error);
  }
}
