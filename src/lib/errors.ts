import { ConvexError } from "convex/values";
import type { AppErrorData, ErrorCode } from "@convex/lib/errors";

const MESSAGES: Record<ErrorCode, string> = {
  UNAUTHENTICATED: "Your session expired. Please sign in again.",
  FORBIDDEN: "You don't have permission to do that.",
  NOT_FOUND: "That item no longer exists.",
  INVALID_INPUT: "Please check the form and try again.",
  CONFLICT: "That can't be done right now.",
  INVALID_TRANSITION: "This request was already updated. Refresh to see its current state.",
};

// Codes whose server message is written for end users and is more specific.
const USER_FACING: ReadonlySet<ErrorCode> = new Set(["INVALID_INPUT", "CONFLICT"]);

/** Maps backend errors to a message safe to show in a toast. */
export function friendlyError(error: unknown): string {
  if (error instanceof ConvexError) {
    const data = error.data as Partial<AppErrorData>;
    if (data.code && data.code in MESSAGES) {
      return USER_FACING.has(data.code) && data.message ? data.message : MESSAGES[data.code];
    }
  }
  return "Something went wrong. Please try again.";
}
