# Decisions

Short ADR-style notes. Each entry: context, decision, consequence. Deviations from
the original brief are marked **Deviation**.

## D1. `src/proxy.ts` instead of `src/middleware.ts` (Deviation)

Next.js 16 renamed Middleware to Proxy. The file is `src/proxy.ts`; it still
exports `clerkMiddleware()`.

## D2. No route matching in the proxy; protect next to the resource (Deviation)

Clerk deprecated `createRouteMatcher()` and now recommends checking auth in the
code that reads or mutates data. The proxy only attaches the Clerk session.
`src/app/(app)/layout.tsx` calls `auth.protect()` to redirect signed-out visitors
(a UX guard), and every public Convex function authorizes the caller itself. A
layout check does not re-run on client-side navigation; that is acceptable
because no data is rendered on the Next.js server: it all comes from Convex,
which rejects unauthenticated calls.

## D3. Keep Next.js Cache Components enabled

`create-next-app` turns on `cacheComponents`. We keep it and follow Clerk core 3
rules: `ClerkProvider` sits inside `<body>`, and any server code that calls
`auth()` renders behind `<Suspense>`.

## D4. Signed-in UI keyed off Convex auth state

UI switches use `<Authenticated>` / `<Unauthenticated>` from `convex/react`
rather than Clerk's `<Show>`, so the UI reflects whether Convex has validated
the token, not only whether a Clerk session exists.

## D5. Index `by_active_category` is `["isActive", "category"]` (Deviation)

The brief names the index `by_category_active`. Putting `isActive` first lets the
same index serve both "all active tools" (landing, unfiltered list) and "active
tools in a category", so one index replaces two.

## D6. Uniqueness enforced in mutations

Convex has no unique constraints. `users.tokenIdentifier`, `notificationOutbox.eventId`
and `reminders.idempotencyKey` are unique by convention: mutations look them up
by index before inserting. Mutations are serializable transactions, so two
concurrent inserts of the same key cannot both commit.

## D7. Convex test module glob (Deviation)

The Convex docs suggest `import.meta.glob("./**/!(*.*.*)*.*s")`. The installed
Vite does not support that extglob (it matched nothing), so
`convex/test.setup.ts` lists explicit exclusions instead.

## D8. Node 22

pnpm 11 requires Node >= 22.13. `.nvmrc` pins 22 and `package.json#engines`
enforces it.

## D9. Availability is derived, and overdue loans still count as "on loan"

Nothing about availability is stored. A tool is "On loan until <endDate>" while
an approved loan has started and has not been marked returned. That includes
overdue loans, because the tool is physically still out. Approved loans that
start in the future don't make a tool unavailable today. "Requested" is shown
per viewer: it means *you* have a pending request on that tool.

## D10. Owners can't delete a tool with open requests or loans

`tools.remove` refuses with `CONFLICT` while a pending or approved loan exists,
instead of silently cancelling other people's requests. The owner resolves them
first (decline or mark returned), which also triggers the right notifications.

## D11. Shared Zod schema for tool input

`convex/lib/toolInput.ts` is imported by both the listing form (inline errors)
and the mutations (the authority). Convex validators guard types at the API
boundary; Zod adds business limits (trimmed length, description <= 500 chars).

## D12. Client waits for `users.store` before rendering app pages

`EnsureUser` upserts the user row once Convex validates the Clerk token, and
holds the page until it completes, so queries that call `requireUser` never race
the first sign-in.

## D13. A request *is* a loan in `pending`

One `loans` table with a status field instead of separate requests and loans
tables. The state machine (`convex/lib/loanStateMachine.ts`) is the only place
transitions are defined; every mutation goes through `assertTransition`, and
each new status maps to exactly one notification type and recipient.

## D14. Loan rules

- Max loan length: 30 days, inclusive of both ends.
- A lender can't approve a request whose end date has already passed.
- Approval rejects any overlap with another *approved* loan on the same tool.
  The check runs inside the mutation, and Convex's serializable transactions
  make concurrent approvals safe.
- Date rules live in `convex/lib/loanRules.ts`, shared by the request dialog
  and the mutation, so the UI and the server always agree.

## D15. Roles live in Convex, not Clerk metadata

`users.role` and `users.trustedLender` are stored in Convex and only changed by
server code. Clerk public metadata would also be server-writable, but then the
role would sit in the JWT and could go stale until the token refreshes, and
Convex functions would trust a claim instead of their own database. Keeping the
role next to the data means authorization runs against one source of truth,
inside the same transaction as the write.

The first admin is created from a trusted shell with the internal
`admin:setRole` mutation. There is no UI or public API path to change a role.

## D16. Admin removal declines pending requests

When an admin removes a listing, pending requests are declined through the
normal state machine, so borrowers are notified. Approved loans stay open: the
tool is physically out and still has to be returned.

## D17. Transactional outbox instead of calling n8n from the mutation

Mutations can't do network I/O, and a direct call from an action after the
mutation could be lost if the action crashes. Each status change inserts a
`notificationOutbox` row and schedules `notifications.deliver` in the same
transaction (Convex's scheduler is transactional), so an event exists if and
only if the status change committed. Delivery is at-least-once: 4 attempts
(immediately, then +30s, +2m, +10m), after which the row is `failed` and an
`automationEvents` row makes it visible on the admin health panel. n8n dedupes
on `eventId`, so retries don't double-send.

## D18. Signed requests in both directions, with separate secrets

`HMAC_SHA256(secret, "${timestamp}.${rawBody}")` in `X-LendLoop-Signature`,
timestamp in `X-LendLoop-Timestamp`, 300 s replay window, constant-time
comparison. `CONVEX_TO_N8N_SECRET` and `N8N_TO_CONVEX_SECRET` are separate, so
leaking one direction doesn't let an attacker forge the other. Convex returns a
generic 401 and logs the reason; it never echoes why verification failed.

## D19. Reminder write-backs: failed can be upgraded to sent, sent is final

The overdue query skips loans with a `sent` reminder for today's key and
includes loans whose reminder `failed`, so the next run retries them. The
write-back inserts when the key is absent, upgrades `failed` to `sent`, and
answers `{ duplicate: true }` otherwise.
