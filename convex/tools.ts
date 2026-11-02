import { query } from "./_generated/server";

const PUBLIC_LIST_LIMIT = 60;

/**
 * Unauthenticated feed for the landing page. Uses an explicit projection so
 * owner ids, descriptions and future fields can never leak by accident.
 */
export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    const tools = await ctx.db
      .query("tools")
      .withIndex("by_active_category", (q) => q.eq("isActive", true))
      .order("desc")
      .take(PUBLIC_LIST_LIMIT);
    return tools.map(({ _id, name, category }) => ({ _id, name, category }));
  },
});
