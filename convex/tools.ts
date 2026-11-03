import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { firstName, requireToolOwner, requireUser } from "./lib/auth";
import { approvedLoansFor, availabilityFrom } from "./lib/availability";
import { todayUtc } from "./lib/dates";
import { appError } from "./lib/errors";
import { parseToolInput } from "./lib/toolInput";
import { toolCategory, toolCondition } from "./lib/validators";

const PUBLIC_LIST_LIMIT = 60;
const LIST_LIMIT = 200;

const toolFields = {
  name: v.string(),
  category: toolCategory,
  condition: toolCondition,
  description: v.string(),
};

/**
 * Unauthenticated feed for the landing page. Uses an explicit projection so
 * owner ids, descriptions and future fields can never leak by accident.
 */
export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    // One extra row tells the landing page whether the board was cut off.
    const tools = await ctx.db
      .query("tools")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .order("desc")
      .take(PUBLIC_LIST_LIMIT + 1);
    return {
      tools: tools.slice(0, PUBLIC_LIST_LIMIT).map(({ _id, name, category }) => ({ _id, name, category })),
      hasMore: tools.length > PUBLIC_LIST_LIMIT,
    };
  },
});

/** Catalog for signed-in users, optionally filtered by category. */
export const list = query({
  args: { category: v.optional(toolCategory) },
  handler: async (ctx, { category }) => {
    const user = await requireUser(ctx);
    // Separate indexes so "desc" always means newest first, never "by category".
    const tools = await (category
      ? ctx.db
          .query("tools")
          .withIndex("by_active_category", (q) => q.eq("isActive", true).eq("category", category))
      : ctx.db.query("tools").withIndex("by_active", (q) => q.eq("isActive", true))
    )
      .order("desc")
      .take(LIST_LIMIT);

    const today = todayUtc();
    return await Promise.all(tools.map((tool) => toCatalogItem(ctx, tool, user._id, today)));
  },
});

/** The caller's own active listings. */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const tools = await ctx.db
      .query("tools")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .order("desc")
      .collect();

    const today = todayUtc();
    return await Promise.all(
      tools
        .filter((tool) => tool.isActive)
        .map(async (tool) => ({
          _id: tool._id,
          name: tool.name,
          category: tool.category,
          condition: tool.condition,
          description: tool.description,
          availability: availabilityFrom(await approvedLoansFor(ctx, tool._id), today),
        })),
    );
  },
});

export const create = mutation({
  args: toolFields,
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const input = parseToolInput(args);
    const now = Date.now();
    return await ctx.db.insert("tools", {
      ...input,
      ownerId: user._id,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: { toolId: v.id("tools"), ...toolFields },
  handler: async (ctx, { toolId, ...fields }) => {
    await requireToolOwner(ctx, toolId);
    const input = parseToolInput(fields);
    await ctx.db.patch(toolId, { ...input, updatedAt: Date.now() });
  },
});

/** Owner soft delete. Blocked while requests or loans are open so nobody is left hanging. */
export const remove = mutation({
  args: { toolId: v.id("tools") },
  handler: async (ctx, { toolId }) => {
    const { user } = await requireToolOwner(ctx, toolId);
    if (await hasOpenLoans(ctx, toolId)) {
      throw appError("CONFLICT", "Resolve pending requests and active loans first");
    }
    await ctx.db.patch(toolId, { isActive: false, removedBy: user._id, updatedAt: Date.now() });
  },
});

async function hasOpenLoans(ctx: QueryCtx, toolId: Id<"tools">): Promise<boolean> {
  for (const status of ["pending", "approved"] as const) {
    const open = await ctx.db
      .query("loans")
      .withIndex("by_tool_status", (q) => q.eq("toolId", toolId).eq("status", status))
      .first();
    if (open) return true;
  }
  return false;
}

async function toCatalogItem(ctx: QueryCtx, tool: Doc<"tools">, callerId: Id<"users">, today: string) {
  const owner = await ctx.db.get(tool.ownerId);
  const myPending = await ctx.db
    .query("loans")
    .withIndex("by_tool_status", (q) => q.eq("toolId", tool._id).eq("status", "pending"))
    .filter((q) => q.eq(q.field("borrowerId"), callerId))
    .first();

  return {
    _id: tool._id,
    name: tool.name,
    category: tool.category,
    condition: tool.condition,
    description: tool.description,
    // First name and badge only: other users' emails never reach the client.
    owner: { firstName: firstName(owner?.name ?? ""), trustedLender: owner?.trustedLender ?? false },
    isMine: tool.ownerId === callerId,
    requestedByMe: myPending !== null,
    availability: availabilityFrom(await approvedLoansFor(ctx, tool._id), today),
  };
}
