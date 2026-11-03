# n8n workflows

Three workflows, exported as JSON. They contain no secrets and no credential
data: shared secrets are read at runtime with `{{ $env.NAME }}`, and the SMTP
node references the credential by id only.

| File | Workflow | Trigger |
|---|---|---|
| `workflows/request-notification.json` | LendLoop · Loan notifications | Webhook `POST /webhook/lendloop-loan-events` (signed by Convex) |
| `workflows/overdue-reminders.json` | LendLoop · Overdue reminders | Daily 09:00 (`GENERIC_TIMEZONE`), plus a manual trigger |
| `workflows/error-handler.json` | LendLoop · Error handler | Error Trigger; set as `errorWorkflow` on the other two |

## First-time setup

With the stack running (`pnpm stack:up`):

1. Open <http://localhost:5678> and create the owner account. n8n requires one
   before anything can be imported.
2. `pnpm n8n:credentials` creates the **Mailpit SMTP** credential (host
   `mailpit`, port 1025, no auth, SSL off). It holds no secret, but it is still
   written to a git-ignored folder and deleted after import.

   *Doing it in the UI instead:* Credentials → Create → SMTP, then set host
   `mailpit`, port `1025`, and turn SSL/TLS off. Then open each email node (three
   in total) and pick that credential, because the imported workflows reference
   the credential id `LLmailpitSmtp001`.
3. `pnpm n8n:import` imports the three workflows, publishes them, and restarts n8n
   so the webhook and schedule register.

Workflow ids are fixed (`LLloanNotify0001`, `LLoverdueRemind1`,
`LLerrorHandler01`) because `settings.errorWorkflow` points at an id. Importing
again updates the workflows in place.

## Export after editing in the UI

```bash
pnpm n8n:export
```

This runs `n8n export:workflow --all --separate`, then
`scripts/n8n-clean-export.mjs` strips instance-specific and runtime fields
(`versionId`, `meta.instanceId`, `pinData`, `staticData`, timestamps, sharing)
and keeps credential references to `{ id, name }`. Last it runs
`scripts/check-secrets.sh`, which fails if a secret, credential data or pinned
data made it into the repo.

## How each workflow works

### Loan notifications

`Webhook (Raw Body on)` → `Verify signature` → `Signature valid?`
→ `Check duplicate` → `Already sent?` → `Route by event type` (Switch, one
output per event type, fallback → `Unknown event type` raises an error)
→ `Compose: <type>` (Edit Fields) → `Send email (Mailpit)`
→ `Remember event` → `Ack: 200` and `Log mock notification`.

- **Signature:** the webhook keeps the raw bytes. The Code node recomputes
  `sha256=HMAC(CONVEX_TO_N8N_SECRET, "${timestamp}.${rawBody}")`, compares it
  with `crypto.timingSafeEqual`, and rejects timestamps more than 300 s off.
  Invalid requests get `401` and nothing else runs.
- **Dedup:** Convex retries until it gets a 2xx, so the same `eventId` can
  arrive more than once. Sent ids are kept in workflow static data and are only
  recorded **after** the email is sent. A duplicate gets `200 {duplicate: true}`
  and no second email. The Remove Duplicates node wasn't used because it
  records the id as soon as the item passes, before the send; a failed send
  followed by a Convex retry would then be dropped silently.
- **Failures:** the send node retries 3 times, 2 s apart. If it still fails, the
  workflow answers `502` so Convex's outbox schedules its own retry
  (30 s / 2 m / 10 m).

### Overdue reminders

`Every day at 09:00` / `Run now (manual)` → `Sign request`
→ `Fetch overdue loans` (signed `GET /n8n/overdue-loans`) → `One item per loan`
→ `Loop over loans` (Split In Batches) → `Compose reminder`
→ `Send reminder email` (retries, then continues on failure)
→ `Sign write-back` → `Record reminder in Convex` (signed
`POST /n8n/reminders`) → back to the loop.

- One failed email doesn't stop the run: the node continues and the
  write-back reports `status: "failed"`, so the next run retries that loan.
- The write-back is idempotent in Convex (key `${loanId}:${YYYY-MM-DD}`), and
  loans with a `sent` reminder for today are excluded from the fetch. Running
  the workflow twice sends one reminder.
- If Convex is unreachable, the HTTP node retries 3 times and then fails the
  execution, which triggers the error workflow.

### Error handler

`On workflow error` → `Summarize error` (execution id, workflow, failing node,
message, with no item data and so no PII) → `Alert admin` (email to
`ADMIN_ALERT_EMAIL`) and `Sign error report` → `Report to Convex` (signed
`POST /n8n/automation-errors`, deduped per execution id). The report shows up
in the admin **Automation health** panel.

In n8n 2.x the error workflow must itself be published, or n8n logs
"is not active and cannot be executed" and skips it. `pnpm n8n:import`
publishes all three.

## Trying it without the web app

```bash
node scripts/n8n-smoke.mjs           # signed valid / duplicate / tampered / wrong-secret / stale events
node scripts/n8n-smoke.mjs unknown   # unknown event type -> error workflow -> admin email + Convex event
docker compose --env-file n8n/.env exec -T -e N8N_RUNNERS_BROKER_PORT=5681 \
  n8n n8n execute --id=LLoverdueRemind1   # run the reminders now
```

The CLI `execute` needs `N8N_RUNNERS_BROKER_PORT` because the running n8n
already holds the default task-broker port. In the editor, open the workflow
and click **Execute workflow** instead.
