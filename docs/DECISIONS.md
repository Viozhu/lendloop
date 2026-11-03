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
