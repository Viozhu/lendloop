import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

describe("tools.listPublic", () => {
  it("returns only _id, name and category for active tools", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const ownerId = await ctx.db.insert("users", {
        tokenIdentifier: "issuer|owner",
        clerkUserId: "user_owner",
        name: "Olivia Owner",
        email: "olivia@example.com",
        role: "user",
        trustedLender: false,
        createdAt: Date.now(),
      });
      const base = {
        ownerId,
        category: "garden" as const,
        condition: "good" as const,
        description: "Private notes about the hedge trimmer",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await ctx.db.insert("tools", { ...base, name: "Hedge trimmer", isActive: true });
      await ctx.db.insert("tools", { ...base, name: "Removed rake", isActive: false });
    });

    const tools = await t.query(api.tools.listPublic, {});

    expect(tools).toHaveLength(1);
    expect(Object.keys(tools[0]).sort()).toEqual(["_id", "category", "name"]);
    expect(tools[0]).toMatchObject({ name: "Hedge trimmer", category: "garden" });
  });
});
