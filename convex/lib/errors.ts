import { ConvexError } from "convex/values";

// Stable codes the client maps to friendly messages. Messages here are for
// developers and logs; never put PII in them.
export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "CONFLICT"
  | "INVALID_TRANSITION";

export type AppErrorData = { code: ErrorCode; message: string };

export function appError(code: ErrorCode, message: string = code): ConvexError<AppErrorData> {
  return new ConvexError({ code, message });
}
