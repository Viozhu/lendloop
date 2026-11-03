# What I'd change for production

LendLoop is built to run locally for review. This is the list of what I'd
change before real neighbors use it, roughly in priority order.

## Automation platform

- **Managed or hardened n8n in queue mode.** Main instance plus workers on
  Redis, so a slow SMTP server or a burst of events doesn't block the webhook
  listener. Task runners in **external** mode (the `n8nio/runners` sidecar)
  instead of the deprecated internal mode used locally, with a sensible
  `N8N_RUNNERS_TASK_TIMEOUT`.
- **Private networking.** n8n's editor and webhook should not be on the public
  internet. Put n8n in a private network, or expose only `/webhook/*` behind an
  allowlist or reverse proxy, and keep the editor behind SSO.
- **Secrets manager and rotation.** Move `CONVEX_TO_N8N_SECRET`,
  `N8N_TO_CONVEX_SECRET` and `N8N_ENCRYPTION_KEY` into a secret manager (Vault,
  AWS/GCP Secret Manager, Doppler). Add a key id to the signature header
  (`X-LendLoop-Signature: v1,kid=2026-11,sha256=...`) and accept both the
  current and previous key during rotation, so secrets rotate with no downtime.
- **Bind the signature to method and path.** The signed string is
  `${timestamp}.${body}` as specified. Including the method and path (and a
  nonce cache) would stop a captured GET from being replayed against another
  endpoint inside the 5-minute window.
- **Rate limiting** on the Convex HTTP endpoints and the n8n webhook, for
  example a token bucket per source plus a global cap. Use the Convex rate-limiter
  component or limits at the proxy.

## Delivery

- **A real email provider** (Postmark, SES, Resend) with SPF, DKIM and DMARC on
  a dedicated sending domain, bounce and complaint webhooks feeding back into
  Convex, and suppression of hard-bounced addresses.
- **Per-user notification preferences and one-click unsubscribe**
  (List-Unsubscribe header). Reminders and transactional notices would be
  separate categories.
- **Dead-letter queue and replay UI.** Failed outbox rows already stay in
  `failed`. Add an admin "Retry" action that resets attempts and reschedules,
  plus bulk replay after an outage. Same for failed reminders.
- **Time zones per user.** "Today" is UTC now. Store an IANA time zone per user,
  compute overdue status and the 09:00 send time in the borrower's zone, and
  show dates in the viewer's locale.

## Identity and data

- **Clerk webhooks (Svix-verified)** for `user.created/updated/deleted`, instead
  of relying only on `users.store` at sign-in. They keep names and emails in
  sync and handle deletions.
- **GDPR deletion and export.** On account deletion, anonymize the user row and
  keep loans for the counterparty's history with "Former neighbor". Offer an
  export of a user's own data.
- **Audit log for admin actions** (role changes, listing removals, Trusted
  Lender toggles): who, what, when, before and after, append-only.
- **Data retention.** Prune `automationEvents` and delivered outbox rows after
  90 days with a Convex cron, and keep aggregates. Cap n8n execution data the
  same way (already set to 14 days locally).
- **Backups.** Convex snapshot exports on a schedule, and Postgres backups for
  n8n, including the encryption key, without which credentials can't be
  restored. Run a restore drill.

## Operations

- **Observability.** Sentry for the Next.js app and Convex functions,
  structured JSON logs with request and event ids, and dashboards for outbox
  lag, retry rate and reminder success.
- **Alerting.** Page on the error workflow, on any outbox row reaching
  `failed`, and on "no reminder run in 26 h" (a dead-man's switch: the schedule
  itself can fail silently).
- **Staging environment** with its own Clerk instance, Convex deployment and
  n8n. Workflows promoted from staging to production through the
  export/import scripts in CI, never edited in production.
- **E2E tests (Playwright)** for request → approve → return, using Clerk test
  users and a Mailpit API assertion that the email arrived.
- **CI deploys.** `npx convex deploy` and n8n import/publish from CI after the
  checks pass, with the secret scan as a required step.

## Product

- Reputation after returns (ratings, condition notes), tool photos (Convex file
  storage with size and type validation), messaging between the two parties
  without exposing emails, and a waitlist when a tool is on loan.
