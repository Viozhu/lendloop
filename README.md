# LendLoop

**Borrow what you need. Lend what you don't.**

A neighborhood tool-lending board. Neighbors list tools, request to borrow
them for a date range, owners approve or decline, and loans get marked as
returned. n8n sends the notifications and a daily overdue reminder. If
automation fails, it shows up in an admin panel.

> _Screenshots / GIF: landing · tools catalog · request dialog · incoming requests · admin automation health._

**Stack:** Next.js 16 (App Router, TypeScript strict) · Clerk · Convex · n8n 2.45 (Docker) · Tailwind 4 + shadcn/ui · Zod · Vitest + convex-test · pnpm

| Doc | What's in it |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Component diagram, notification and reminder sequences, security and data minimization |
| [docs/DECISIONS.md](docs/DECISIONS.md) | ADR-style decisions, including every deviation from the brief |
| [docs/PRODUCTION.md](docs/PRODUCTION.md) | What I'd change before real users |
| [n8n/README.md](n8n/README.md) | Workflow internals, import/export, smoke tests |

## Prerequisites

- Node **22.13+** (`nvm use` reads `.nvmrc`) and pnpm 11 (`corepack enable`)
- Docker with Compose v2
- A free [Clerk](https://clerk.com) application:
  1. Create an application (email or Google sign-in is fine).
  2. **Configure → Integrations → Convex → Activate.** Copy the **Frontend API
     URL** (`https://<name>.clerk.accounts.dev`); that is `CLERK_JWT_ISSUER_DOMAIN`.
  3. **API keys:** copy the publishable key and the secret key.

## Quickstart

```bash
pnpm install
cp .env.example .env.local        # then paste the two Clerk keys into .env.local
npx convex dev                    # choose a *local* deployment; keep it running (terminal 1)
pnpm setup:local https://<name>.clerk.accounts.dev   # n8n/.env with fresh secrets + Convex env vars
pnpm stack:up                     # n8n + Postgres + Mailpit; open http://localhost:5678 and create the n8n owner
pnpm n8n:credentials              # Mailpit SMTP credential (no secrets involved)
pnpm n8n:import                   # import + publish the 3 workflows
pnpm dev                          # http://localhost:3000, then sign in once (terminal 2)
npx convex run admin:setRole '{"email":"you@example.com"}'
pnpm seed '{"forEmail":"you@example.com"}'
```

Emails land in **Mailpit at <http://localhost:8025>**. Right after seeding you
should see two "New request" emails (one to the demo lender Maya, one to you).

`npx convex dev` writes `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL` and
`NEXT_PUBLIC_CONVEX_SITE_URL` into `.env.local`. The local backend serves the
client API on `:3210` and HTTP actions on `:3211`.

### Using a cloud Convex deployment instead

A cloud deployment can't reach `localhost:5678`. Expose n8n with a tunnel
(`cloudflared tunnel --url http://localhost:5678` or `ngrok http 5678`), then:

- `N8N_NOTIFY_WEBHOOK_URL=<tunnel>/webhook/lendloop-loan-events pnpm setup:local`
- In `n8n/.env`: `CONVEX_HTTP_URL=https://<deployment>.convex.site` and
  `N8N_WEBHOOK_URL=<tunnel>/`. Then run `pnpm stack:up` again.

## Trying each workflow

| Workflow | How to trigger it | What to look for |
|---|---|---|
| **Loan notifications** | Any status change in the app: request, approve, decline, cancel, mark returned. `pnpm seed` also queues one. | An email in Mailpit, "Lender notified …" on the loan card, and the outbox row `delivered`. |
| **Overdue reminders** | n8n editor → *LendLoop · Overdue reminders* → **Execute workflow**, or `pnpm n8n:remind`. The seed creates an overdue Pressure washer loan, plus a Tile saw loan for you with `forEmail`. | A "Reminder: please return …" email; "Reminder sent" on the loan card. Run it again: no second email (idempotent). |
| **Error handler** | `pnpm n8n:smoke unknown` sends a signed event with an unknown type, so the published webhook workflow fails. n8n doesn't call error workflows for manual editor runs. | An `[LendLoop] Workflow failed` email to `ADMIN_ALERT_EMAIL`, and the error under **Admin → Automation health**. |

To exercise the signature checks without the app, run `pnpm n8n:smoke`. It
sends a valid event (200), the same event again (200, duplicate: no second
email), a tampered body (401), a wrong secret (401) and a stale timestamp (401).

To see retries, run `docker compose --env-file n8n/.env stop mailpit` and then
approve something. The card shows "Notification failed – retrying", and
**Automation health** lists it with the next attempt time. Start Mailpit again
and it gets delivered.

## Environment variables

Every variable is documented in [`.env.example`](.env.example) and
[`n8n/.env.example`](n8n/.env.example). Nothing secret is committed.
`pnpm check-secrets` (also run in CI) verifies that.

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | `.env.local` (written by Convex CLI) | Convex client URL |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `.env.local` | Clerk publishable key |
| `CLERK_SECRET_KEY` | `.env.local` | Clerk secret key (server only) |
| `CLERK_JWT_ISSUER_DOMAIN` | Convex env | Clerk Frontend API URL; Convex validates JWTs against it |
| `N8N_NOTIFY_WEBHOOK_URL` | Convex env | n8n webhook that receives loan events |
| `CONVEX_TO_N8N_SECRET` | Convex env **and** `n8n/.env` | Convex signs events, n8n verifies |
| `N8N_TO_CONVEX_SECRET` | Convex env **and** `n8n/.env` | n8n signs calls to `/n8n/*`, Convex verifies |
| `APP_BASE_URL` | Convex env and `n8n/.env` | Links in emails |
| `N8N_ENCRYPTION_KEY` | `n8n/.env` | Encrypts n8n credentials at rest; keep it stable |
| `CONVEX_HTTP_URL` | `n8n/.env` | Where n8n reaches Convex (`http://host.docker.internal:3211` locally) |
| `ADMIN_ALERT_EMAIL` | `n8n/.env` | Recipient of error-workflow alerts |
| `GENERIC_TIMEZONE` | `n8n/.env` | Time zone of the 09:00 schedule |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `n8n/.env` | n8n's own database |
| `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` | `docker-compose.yml` | Lets Code nodes read the secrets via `$env` (n8n 2.x blocks it by default) |

Convex variables are set with `npx convex env set` (`pnpm setup:local` does it
for you). Convex functions can't read `.env.local`.

## Roles

- **User:** lists, edits and deletes their own tools; requests any active tool
  except their own; cancels their own pending requests; approves, declines and
  marks returned on loans of their own tools.
- **Admin:** all of the above, plus removing any listing (pending requests are
  declined and borrowers notified), viewing all loans, toggling **Trusted
  Lender**, and the **Automation health** panel.

Roles are stored in Convex and enforced in every function. There is no UI or
API path to become an admin. The first admin is created from the CLI with
`npx convex run admin:setRole '{"email":"..."}'`; the user must have signed in
once.

## Scripts

| Command | Does |
|---|---|
| `pnpm dev` / `pnpm build` | Next.js |
| `pnpm typecheck` · `pnpm lint` · `pnpm test` | Checks (also in CI) |
| `pnpm setup:local [issuer]` | Create `n8n/.env` with random secrets and push shared values to Convex |
| `pnpm stack:up` / `pnpm stack:down` | Start or stop n8n, Postgres and Mailpit |
| `pnpm n8n:credentials` | Create the Mailpit SMTP credential in n8n |
| `pnpm n8n:import` / `pnpm n8n:export` | Import and publish workflows / export, clean and secret-scan them |
| `pnpm n8n:smoke [unknown]` | Signed test events against the webhook |
| `pnpm n8n:remind` | Run the overdue reminders now |
| `pnpm seed ['{"forEmail":"..."}']` | Demo neighborhood with an overdue loan |
| `pnpm check-secrets` | Scan the repo for secrets |

## Tests

`pnpm test` runs 57 Vitest + convex-test cases against an in-memory Convex. They
cover:

- **RBAC:** editing or deleting another user's tool, approving a loan on someone
  else's tool, borrowing your own tool, setting your own role, and an admin
  removing any listing.
- **Loan state machine:** valid and invalid transitions, and overlapping
  approvals.
- **Public projection:** `listPublic` returns exactly `_id`, `name` and
  `category`.
- **HMAC:** a known vector, tampering, wrong secret, stale timestamp and swapped
  timestamp.
- **Signed HTTP endpoints:** 401, 503 and replay handling, and idempotent
  reminder write-back (one row for the same key).
- **Outbox:** atomic with the status change, no row when the change is rejected,
  retries and backoff, and payload minimization.
- **Activity feed, health panel and seed.**
