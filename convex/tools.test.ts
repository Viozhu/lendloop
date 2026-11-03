import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { createTool, createUser, expectCode, setup, validTool } from "./test.helpers";

describe("tools.listPublic", () => {
  it("returns only _id, name and category for active tools", async () => {
    const t = setup();
    const { userId } = await createUser(t, { name: "Olivia Owner" });
    await createTool(t, userId, "Hedge trimmer");
    const removed = await createTool(t, userId, "Removed rake");
    await t.run((ctx) => ctx.db.patch(removed, { isActive: false }));

    const tools = await t.query(api.tools.listPublic, {});

    expect(tools).toHaveLength(1);
    expect(Object.keys(tools[0]).sort()).toEqual(["_id", "category", "name"]);
    expect(tools[0].name).toBe("Hedge trimmer");
  });
});

describe("tools ordering", () => {
  it("lists the newest tools first regardless of category", async () => {
    const t = setup();
    const { userId, as } = await createUser(t, { name: "Olivia Owner" });
    await as.mutation(api.tools.create, { ...validTool, name: "Old other", category: "other" });
    await as.mutation(api.tools.create, { ...validTool, name: "New camping", category: "camping" });

    expect((await t.query(api.tools.listPublic, {})).map((x) => x.name)).toEqual(["New camping", "Old other"]);
    expect((await as.query(api.tools.list, {})).map((x) => x.name)).toEqual(["New camping", "Old other"]);
    void userId;
  });
});

describe("tools RBAC", () => {
  it("rejects unauthenticated callers", async () => {
    const t = setup();
    await expectCode(t.mutation(api.tools.create, validTool), "UNAUTHENTICATED");
    await expectCode(t.query(api.tools.list, {}), "UNAUTHENTICATED");
  });

  it("rejects a signed-in identity that has no stored user row", async () => {
    const t = setup();
    const ghost = t.withIdentity({ tokenIdentifier: "https://clerk.test|ghost" });
    await expectCode(ghost.mutation(api.tools.create, validTool), "UNAUTHENTICATED");
  });

  it("lets the owner create, edit and delete their tool", async () => {
    const t = setup();
    const { as } = await createUser(t, { name: "Olivia Owner" });

    const toolId = await as.mutation(api.tools.create, validTool);
    await as.mutation(api.tools.update, { toolId, ...validTool, name: "Tall ladder" });
    expect((await as.query(api.tools.listMine, {}))[0].name).toBe("Tall ladder");

    await as.mutation(api.tools.remove, { toolId });
    expect(await as.query(api.tools.listMine, {})).toEqual([]);
    const stored = await t.run((ctx) => ctx.db.get(toolId));
    expect(stored?.isActive).toBe(false); // soft delete
  });

  it("forbids editing or deleting another user's tool", async () => {
    const t = setup();
    const owner = await createUser(t, { name: "Olivia Owner" });
    const other = await createUser(t, { name: "Mallory Other" });
    const toolId = await createTool(t, owner.userId);

    await expectCode(
      other.as.mutation(api.tools.update, { toolId, ...validTool }),
      "FORBIDDEN",
    );
    await expectCode(other.as.mutation(api.tools.remove, { toolId }), "FORBIDDEN");
    const stored = await t.run((ctx) => ctx.db.get(toolId));
    expect(stored?.name).toBe("Cordless drill");
    expect(stored?.isActive).toBe(true);
  });

  it("blocks deleting a tool with an open request", async () => {
    const t = setup();
    const owner = await createUser(t, { name: "Olivia Owner" });
    const borrower = await createUser(t, { name: "Ben Borrower" });
    const toolId = await createTool(t, owner.userId);
    await t.run((ctx) =>
      ctx.db.insert("loans", {
        toolId,
        borrowerId: borrower.userId,
        lenderId: owner.userId,
        startDate: "2099-01-01",
        endDate: "2099-01-03",
        status: "pending",
        createdAt: Date.now(),
      }),
    );

    await expectCode(owner.as.mutation(api.tools.remove, { toolId }), "CONFLICT");
  });

  it("validates input on the server", async () => {
    const t = setup();
    const { as } = await createUser(t, { name: "Olivia Owner" });
    await expectCode(as.mutation(api.tools.create, { ...validTool, name: " " }), "INVALID_INPUT");
    await expectCode(
      as.mutation(api.tools.create, { ...validTool, description: "x".repeat(501) }),
      "INVALID_INPUT",
    );
  });
});

describe("tools.list", () => {
  it("exposes the owner's first name and badge, never their email", async () => {
    const t = setup();
    const owner = await createUser(t, { name: "Olivia Owner", trustedLender: true });
    const viewer = await createUser(t, { name: "Ben Borrower" });
    await createTool(t, owner.userId);

    const [item] = await viewer.as.query(api.tools.list, {});

    expect(item.owner).toEqual({ firstName: "Olivia", trustedLender: true });
    expect(JSON.stringify(item)).not.toContain("@example.com");
    expect(item.isMine).toBe(false);
    expect(item.availability).toEqual({ status: "available" });
  });

  it("filters by category", async () => {
    const t = setup();
    const { userId, as } = await createUser(t, { name: "Olivia Owner" });
    await createTool(t, userId);
    await as.mutation(api.tools.create, { ...validTool, category: "garden" });

    const garden = await as.query(api.tools.list, { category: "garden" });
    expect(garden.map((tool) => tool.category)).toEqual(["garden"]);
  });

  it("marks a tool on loan while an approved loan has started", async () => {
    const t = setup();
    const owner = await createUser(t, { name: "Olivia Owner" });
    const borrower = await createUser(t, { name: "Ben Borrower" });
    const toolId = await createTool(t, owner.userId);
    await t.run((ctx) =>
      ctx.db.insert("loans", {
        toolId,
        borrowerId: borrower.userId,
        lenderId: owner.userId,
        startDate: "2000-01-01",
        endDate: "2000-01-05", // overdue, still out
        status: "approved",
        createdAt: Date.now(),
      }),
    );

    const [item] = await borrower.as.query(api.tools.list, {});
    expect(item.availability).toEqual({ status: "on_loan", until: "2000-01-05" });
  });
});
