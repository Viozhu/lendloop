import { v, type Infer } from "convex/values";

// Shared enum validators. The arrays are exported so the UI renders the same
// options the backend accepts, without a second hand-maintained list.

export const TOOL_CATEGORIES = [
  "power_tools",
  "hand_tools",
  "garden",
  "kitchen",
  "camping",
  "cleaning",
  "other",
] as const;

export const toolCategory = v.union(
  v.literal("power_tools"),
  v.literal("hand_tools"),
  v.literal("garden"),
  v.literal("kitchen"),
  v.literal("camping"),
  v.literal("cleaning"),
  v.literal("other"),
);
export type ToolCategory = Infer<typeof toolCategory>;

export const TOOL_CONDITIONS = ["new", "good", "fair", "worn"] as const;

export const toolCondition = v.union(
  v.literal("new"),
  v.literal("good"),
  v.literal("fair"),
  v.literal("worn"),
);
export type ToolCondition = Infer<typeof toolCondition>;

export const userRole = v.union(v.literal("admin"), v.literal("user"));
export type UserRole = Infer<typeof userRole>;

export const loanStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("declined"),
  v.literal("cancelled"),
  v.literal("returned"),
);
export type LoanStatus = Infer<typeof loanStatus>;

export const notificationType = v.union(
  v.literal("loan.requested"),
  v.literal("loan.approved"),
  v.literal("loan.declined"),
  v.literal("loan.cancelled"),
  v.literal("loan.returned"),
);
export type NotificationType = Infer<typeof notificationType>;

export const outboxStatus = v.union(
  v.literal("pending"),
  v.literal("delivered"),
  v.literal("failed"),
);

export const reminderStatus = v.union(v.literal("sent"), v.literal("failed"));

export const automationEventKind = v.union(
  v.literal("notification_sent"),
  v.literal("notification_failed"),
  v.literal("reminder_sent"),
  v.literal("reminder_failed"),
  v.literal("workflow_error"),
);
export type AutomationEventKind = Infer<typeof automationEventKind>;

export const automationSource = v.union(v.literal("convex"), v.literal("n8n"));
