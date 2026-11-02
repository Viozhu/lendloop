import type { ToolCategory, ToolCondition } from "@convex/lib/validators";

export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  power_tools: "Power tools",
  hand_tools: "Hand tools",
  garden: "Garden",
  kitchen: "Kitchen",
  camping: "Camping",
  cleaning: "Cleaning",
  other: "Other",
};

export const CONDITION_LABELS: Record<ToolCondition, string> = {
  new: "New",
  good: "Good",
  fair: "Fair",
  worn: "Worn",
};
