/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { expect } from "vitest";
import type { Id } from "./_generated/dataModel";
import type { ErrorCode } from "./lib/errors";
import schema from "./schema";
import { modules } from "./test.setup";

// Test-only helpers. The double dot in the filename keeps Convex from deploying it.

export function setup() {
  return convexTest(schema, modules);
}

type T = ReturnType<typeof setup>;

export async function createUser(
  t: T,
  opts: { name: string; role?: "admin" | "user"; trustedLender?: boolean },
) {
  const subject = opts.name.toLowerCase().replace(/\s+/g, "-");
  const tokenIdentifier = `https://clerk.test|${subject}`;
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      tokenIdentifier,
      clerkUserId: subject,
      name: opts.name,
      email: `${subject}@example.com`,
      role: opts.role ?? "user",
      trustedLender: opts.trustedLender ?? false,
      createdAt: Date.now(),
    }),
  );
  const as = t.withIdentity({ tokenIdentifier, subject, name: opts.name });
  return { userId, as };
}

export async function createTool(t: T, ownerId: Id<"users">, name = "Cordless drill") {
  return await t.run((ctx) =>
    ctx.db.insert("tools", {
      ownerId,
      name,
      category: "power_tools",
      condition: "good",
      description: "18V with two batteries",
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  );
}

/** Asserts the promise rejects with a ConvexError carrying `code`. */
export async function expectCode(promise: Promise<unknown>, code: ErrorCode) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error, `expected ${code}`).toBeInstanceOf(ConvexError);
  expect((error as ConvexError<{ code: ErrorCode }>).data.code).toBe(code);
}

export const validTool = {
  name: "Ladder",
  category: "hand_tools",
  condition: "fair",
  description: "3m aluminium ladder",
} as const;
