import { z } from "zod";
import { TOOL_CATEGORIES, TOOL_CONDITIONS } from "./validators";
import { appError } from "./errors";

export const TOOL_NAME_MAX = 80;
export const TOOL_DESCRIPTION_MAX = 500;

// Shared by the listing form (inline errors) and the tools mutations (the
// authority). Convex validators check types; this checks business limits.
export const toolInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(TOOL_NAME_MAX, `Name must be at most ${TOOL_NAME_MAX} characters`),
  category: z.enum(TOOL_CATEGORIES),
  condition: z.enum(TOOL_CONDITIONS),
  description: z
    .string()
    .trim()
    .max(TOOL_DESCRIPTION_MAX, `Description must be at most ${TOOL_DESCRIPTION_MAX} characters`),
});

export type ToolInput = z.infer<typeof toolInputSchema>;

export function parseToolInput(input: unknown): ToolInput {
  const result = toolInputSchema.safeParse(input);
  if (!result.success) {
    throw appError("INVALID_INPUT", result.error.issues[0]?.message ?? "Invalid tool");
  }
  return result.data;
}
