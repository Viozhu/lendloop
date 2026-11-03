# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary audience: take-home reviewers.** Engineers evaluating the
  assignment on code structure, security thinking, UX and practicality, n8n
  integration design and reliability, and documentation. They clone the repo,
  follow the README quickstart, click through the app, and read the docs.
  Success: within a few minutes they understand what the product does, see
  that authorization, signing and automation are sound, and can trigger every
  workflow themselves.
- **Product user (the fiction the app serves): neighbors.** People in one
  neighborhood who own tools they rarely use, or need a tool once. Lenders
  list tools and approve, decline or close loans. Borrowers browse, request a
  date range, and get notified. An admin moderates listings, marks Trusted
  Lenders, and watches automation health.

## Product Purpose

A neighborhood tool-lending board. Neighbors list tools, request to borrow
them for a date range, owners approve or decline, and loans get marked as
returned. n8n sends the email notifications and a daily overdue reminder;
anything that fails in automation is visible to admins. As a take-home, it
exists to demonstrate production-minded engineering at a small scope.

## Positioning

Small scope, production discipline. The differentiators are in the mechanism:
authorization enforced in the backend on every function, a transactional
outbox so no notification is lost, HMAC-signed traffic in both directions with
separate secrets, idempotent reminder write-backs, and a health panel so
nothing fails silently.

## Operating Context

- Runs locally: Next.js on `localhost:3000`, a Convex local deployment
  (`:3210`/`:3211`), and n8n + Postgres + Mailpit in Docker Compose. All email
  lands in Mailpit (`localhost:8025`). There is no production deployment.
- Reviewers seed demo data (`pnpm seed`) and trigger workflows from the n8n
  editor or `pnpm` scripts, then read `README.md` and `docs/`.
- Sign-in is Clerk (development instance). The first admin is set from the CLI.

## Capabilities and Constraints

- Roles: `user` and `admin`, stored in Convex, enforced server-side.
- Loan lifecycle: `pending → approved | declined | cancelled`, `approved → returned`. A request *is* a loan in `pending`.
- Rules: start date today or later, end on or after start, max 30 days, no overlapping approvals (an unreturned overdue loan still blocks), no borrowing your own tool.
- Tool categories: power tools, hand tools, garden, kitchen, camping, cleaning, other. Conditions: new, good, fair, worn.
- Terminology in the UI: Tools, My listings, My requests, Incoming, Admin, Trusted Lender, Automation health.
- Data minimization: other users appear by first name only. The public page shows only tool name and category.
- Language: English only, UI and emails.
- Stack is fixed by the brief: Next.js 16 App Router, Clerk, Convex, n8n, Tailwind + shadcn/ui.

## Brand Commitments

- Name: **LendLoop**. Tagline: **"Borrow what you need. Lend what you don't."** (fixed by the brief).
- Voice: plain, friendly, neighborly. Short labels and specific error messages ("This loan hasn't started yet, so it can't be returned").
- No logo or brand assets exist.

## Evidence on Hand

- `docs/media/walkthrough.gif`: recorded walkthrough of the real local app.
- Seeded demo neighbors (Maya, Sam, Priya, Leo) and tools, all fictional and labeled as demo data.
- No real users, testimonials, usage numbers or neighborhoods exist. Never invent them.

## Product Principles

1. **The reviewer's first five minutes decide it.** Every surface should make the product and its engineering quality legible fast.
2. **The backend decides; the UI explains.** The UI hides what you can't do and explains refusals clearly, but never pretends to be the authority.
3. **Nothing fails silently.** Every automation outcome, good or bad, is visible to the person it concerns.
4. **Show neighbors as little as possible of each other.** First names only, emails never.
5. **Small scope, no gold-plating.** Polish what exists before adding features.

## Accessibility & Inclusion

Target **WCAG 2.2 AA**: text and UI contrast, full keyboard operation, visible focus, labelled controls, screen-reader-friendly dialogs and live regions, responsive layouts down to phone width.
