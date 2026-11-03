import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { setup } from "./test.helpers";

const identity = {
  tokenIdentifier: "https://clerk.test|user_1",
  subject: "user_1",
  name: "Ada Lovelace",
  email: "ada@example.com",
};

describe("users.store", () => {
  it("creates a plain user from the verified identity", async () => {
    const t = setup();
    const as = t.withIdentity(identity);

    await as.mutation(api.users.store, {});

    const me = await as.query(api.users.me, {});
    expect(me).toMatchObject({
      name: "Ada Lovelace",
      firstName: "Ada",
      email: "ada@example.com",
      role: "user",
      trustedLender: false,
    });
  });

  it("is idempotent and never resets a server-assigned role", async () => {
    const t = setup();
    const as = t.withIdentity(identity);
    const userId = await as.mutation(api.users.store, {});
    await t.run((ctx) => ctx.db.patch(userId, { role: "admin", trustedLender: true }));

    await as.mutation(api.users.store, {});

    const users = await t.run((ctx) => ctx.db.query("users").collect());
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ role: "admin", trustedLender: true });
  });

  it("does not let the client set its own role", async () => {
    const t = setup();
    const as = t.withIdentity(identity);

    // The validator accepts no arguments, so role cannot be smuggled in.
    await expect(
      as.mutation(api.users.store, { role: "admin" } as unknown as Record<string, never>),
    ).rejects.toThrow();
    expect(await t.run((ctx) => ctx.db.query("users").collect())).toEqual([]);
  });

  it("requires an identity", async () => {
    const t = setup();
    await expect(t.mutation(api.users.store, {})).rejects.toThrow(/UNAUTHENTICATED/);
    expect(await t.query(api.users.me, {})).toBeNull();
  });
});
