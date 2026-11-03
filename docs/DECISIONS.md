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

## D20. Local networking: Convex local deployment, n8n in Docker

Default setup is a Convex **local** deployment (`npx convex dev`, HTTP actions
on `127.0.0.1:3211`) plus n8n in Docker. Convex calls
`http://localhost:5678/webhook/...` directly. n8n calls Convex at
`http://host.docker.internal:3211`. Docker Desktop forwards that to the host's
loopback; on Linux the `extra_hosts: host-gateway` entry provides the name.
Verified end to end on macOS: both directions, the error path, and the reminder
write-back.

With a cloud Convex deployment, Convex can't reach your laptop. Expose n8n
through a tunnel (`cloudflared tunnel --url http://localhost:5678` or ngrok),
set `N8N_NOTIFY_WEBHOOK_URL` in Convex to the tunnel URL, set `WEBHOOK_URL` in
n8n to it as well, and point `CONVEX_HTTP_URL` in `n8n/.env` at
`https://<deployment>.convex.site`.

## D21. Dedup in workflow static data, not Remove Duplicates (Deviation)

Remove Duplicates ("across executions") stores the value as soon as the item
passes through, before the email is sent. If the send then fails and Convex
retries, the retry would be treated as a duplicate and the notification lost
while Convex sees a 200. The workflow keeps sent `eventId`s in
`$getWorkflowStaticData('global')` and writes them only after a successful
send. Entries expire after 7 days, far beyond Convex's ~13 minute retry window.

## D22. Fixed workflow ids are kept in the export (Deviation)

The brief says to strip `id` on export. `settings.errorWorkflow` references the
error handler by id, so stripping ids would break that link on every import.
The three workflows use fixed ids (`LLloanNotify0001`, `LLoverdueRemind1`,
`LLerrorHandler01`) and the export keeps them. Instance-specific fields
(`versionId`, `meta.instanceId`, `pinData`, `staticData`, timestamps) are still
stripped.

## D23. n8n 2.x specifics

- "Active" is now "published": `pnpm n8n:import` runs `n8n publish:workflow`
  and restarts n8n, which loads published state at startup.
- The error workflow must be published too, or n8n refuses to call it.
- `N8N_BLOCK_ENV_ACCESS_IN_NODE` defaults to `true` in 2.x; compose sets it to
  `false` because the Code nodes read the shared secrets through `$env`.
  `NODE_FUNCTION_ALLOW_BUILTIN=crypto` allows `require('crypto')`.
- Task runners run in internal mode, which is deprecated but fine locally.
  PRODUCTION.md covers external runners.
- n8n 2.45 warns that Postgres 16 is outside its supported range, so the stack
  pins Postgres 17.
- The Webhook node's Raw Body option puts the bytes in binary property `data`,
  read with `this.helpers.getBinaryDataBuffer(0, 'data')`.

## D24. Event routing: Switch plus one Edit Fields node per type

The webhook workflow routes on `type` with a Switch node whose outputs are
named after the event types. Each output feeds a small "Compose" node with the
subject and body as expressions, so editing a message needs no code. Unknown
types go to a Stop and Error node, which fails the execution, triggers the
error workflow, and makes Convex retry and then park the event as failed.

## D25. `APP_BASE_URL` lives in n8n, not in the payload

Links in emails are built in n8n from `$env.APP_BASE_URL`. The Convex payload
stays exactly the documented minimal shape. Convex still has `APP_BASE_URL`
set, so a future channel built in Convex could use it.

## D26. Mailpit credential created by script

`pnpm n8n:credentials` writes the Mailpit SMTP credential to a git-ignored file,
imports it with a fixed id, and deletes the file. Mailpit needs no
authentication, so the credential contains no secret, but credential files
never go into the repo anyway. The README also documents the manual UI steps.

## D27. Seed runs inside Convex (Deviation)

The brief lists `scripts/seed.ts`. The seed is `convex/seed.ts`, an
`internalMutation` run with `pnpm seed` (`convex run seed:run`). It executes
inside one transaction, reuses the real outbox helper (the seeded pending
request is delivered to n8n like any other), and can't be called from a
browser. A Node script would need an admin key or a public mutation to do the
same. Demo neighbors get synthetic token identifiers, so nobody can sign in as
them. `{"forEmail": "..."}` adds an incoming request and an overdue loan for a
real account that has signed in once.

## D28. Activity feed wording

Loan parties see short, friendly labels ("Lender notified", "Reminder sent",
"Notification failed – retrying") derived from `automationEvents` and retrying
outbox rows. Raw error strings stay out of their view; admins see them on the
Automation health panel.

## D29. Changes after an independent review

A separate reviewer pass found no authorization or data-exposure issues. It did
find these correctness gaps, now fixed:

- **Overdue loans block approvals.** An approved loan that's past its end date
  but not returned still holds the tool, so its effective end for overlap
  checks is `max(endDate, today)`. Before this, a lender could approve a second
  loan for today while the tool was still out.
- **Outbox safety net.** Convex runs scheduled actions at most once. If
  `deliver` died before recording a result, nothing would ever retry it.
  `crons.ts` runs `notifications.sweepStuck` every 5 minutes and reschedules
  pending events that haven't been touched for 5 minutes; n8n's dedup absorbs
  any overlap. Events whose loan or recipient was deleted are parked as
  `failed` instead of staying `pending` forever.
- **Convex waits 30 s for n8n** (was 10 s), longer than the workflow's worst
  case against a healthy SMTP server, so Convex doesn't retry while n8n is
  still sending. The remaining duplicate-email race is covered in PRODUCTION.md.
- **Newest-first lists.** A `by_active` index serves the unfiltered catalog and
  landing. Ordering on `by_active_category` sorted by category first and cut
  whole categories off at the limit.
- **Reminder batches.** The batch limit counts only loans still due today, and
  a failed write-back no longer stops the loop. A "Check write-backs" node fails
  the run once the loop ends, so the error workflow still reports it.
- **No "returned" before a loan starts.** Lenders could use "Mark returned" to
  undo a future approval, and the borrower got a thank-you email. Cancelling an
  approved future loan is not in the brief's state machine; PRODUCTION.md lists
  it.
