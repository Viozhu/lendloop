import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export type Availability = { status: "available" } | { status: "on_loan"; until: string };

/**
 * Derived, never stored. A tool is on loan while an approved loan has started
 * and has not been marked returned, including overdue loans: the tool is still
 * physically out. Future approved loans don't block today.
 */
export function availabilityFrom(approvedLoans: Doc<"loans">[], today: string): Availability {
  const current = approvedLoans.find((loan) => loan.startDate <= today);
  return current ? { status: "on_loan", until: current.endDate } : { status: "available" };
}

export async function approvedLoansFor(ctx: QueryCtx, toolId: Id<"tools">) {
  return await ctx.db
    .query("loans")
    .withIndex("by_tool_status", (q) => q.eq("toolId", toolId).eq("status", "approved"))
    .collect();
}
