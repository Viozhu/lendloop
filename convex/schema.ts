import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  automationEventKind,
  automationSource,
  loanStatus,
  notificationType,
  outboxStatus,
  reminderStatus,
  toolCategory,
  toolCondition,
  userRole,
} from "./lib/validators";

// Convex has no unique constraints. Fields documented as "unique" below are
// enforced by looking up the index inside a mutation, which is safe because
// mutations are serializable transactions.

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(), // unique
    clerkUserId: v.string(),
    name: v.string(),
    email: v.string(),
    role: userRole,
    trustedLender: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_email", ["email"]),

  tools: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    category: toolCategory,
    condition: toolCondition,
    description: v.string(),
    isActive: v.boolean(),
    removedBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    // isActive first so the same index serves "all active" and "active in category".
    .index("by_active_category", ["isActive", "category"]),

  loans: defineTable({
    toolId: v.id("tools"),
    borrowerId: v.id("users"),
    lenderId: v.id("users"), // denormalized from the tool for RBAC and indexes
    startDate: v.string(), // YYYY-MM-DD
    endDate: v.string(), // YYYY-MM-DD
    status: loanStatus,
    decidedAt: v.optional(v.number()),
    returnedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_tool_status", ["toolId", "status"])
    .index("by_borrower", ["borrowerId"])
    .index("by_lender", ["lenderId"])
    .index("by_status_endDate", ["status", "endDate"]),

  notificationOutbox: defineTable({
    eventId: v.string(), // unique
    loanId: v.id("loans"),
    type: notificationType,
    recipientUserId: v.id("users"),
    status: outboxStatus,
    attempts: v.number(),
    lastError: v.optional(v.string()),
    nextAttemptAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
  })
    .index("by_eventId", ["eventId"])
    .index("by_status", ["status"]),

  reminders: defineTable({
    idempotencyKey: v.string(), // unique, `${loanId}:${YYYY-MM-DD}`
    loanId: v.id("loans"),
    status: reminderStatus,
    channel: v.string(),
    n8nExecutionId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_idempotencyKey", ["idempotencyKey"])
    .index("by_status", ["status"]),

  automationEvents: defineTable({
    loanId: v.optional(v.id("loans")),
    kind: automationEventKind,
    message: v.string(),
    source: automationSource,
    externalId: v.optional(v.string()), // dedup key for n8n-originated events
    createdAt: v.number(),
  })
    .index("by_loan", ["loanId"])
    .index("by_externalId", ["externalId"])
    .index("by_kind", ["kind"]),
});
