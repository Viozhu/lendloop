import type { ReactNode } from "react";
import { ArrowDownIcon, ArrowUpRightIcon } from "lucide-react";
import { LandingCta } from "@/components/landing-cta";
import { PublicToolBoard } from "@/components/public-tool-board";
import { Wordmark } from "@/components/wordmark";

const REPO_URL = "https://github.com/Viozhu/lendloop";

const STEPS = [
  {
    title: "List what you own",
    body: "The drill gathering dust, the ladder you need once a year. Add it to the board in a minute.",
  },
  {
    title: "Ask for the days you need",
    body: "Pick a date range, up to 30 days. The owner sees your first name, never your email.",
  },
  {
    title: "Get a yes by email",
    body: "Approvals, reminders and returns arrive by email, so nobody has to chase anyone.",
  },
];

// For reviewers. Each line is a property the code enforces and the docs explain.
const MECHANISMS = [
  {
    title: "Authorization lives in the backend",
    body: "Every Convex query and mutation checks who is calling. The UI only hides buttons, and nobody can grant themselves a role from the browser.",
  },
  {
    title: "No notification gets lost",
    body: "Each status change writes its notification to an outbox in the same transaction. Delivery to n8n retries at 30 s, 2 min and 10 min.",
  },
  {
    title: "Signed in both directions",
    body: "Convex and n8n sign every request with HMAC‑SHA256 over the raw body and a timestamp, with a separate secret for each direction.",
  },
  {
    title: "Nothing fails silently",
    body: "Failed deliveries, failed reminders and n8n workflow errors all land on the admin's Automation health panel.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <Wordmark />
        {/* Reviewers are the primary audience: one quiet jump to the engineering notes. */}
        <a
          href="#under-the-hood"
          className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          For reviewers
          <ArrowDownIcon aria-hidden className="size-3.5 text-primary" />
        </a>
      </header>

      <main className="flex flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 pt-6 pb-20 sm:gap-16 sm:px-6 sm:pt-10">
          <section className="flex flex-col gap-6">
            <h1 className="max-w-[16ch] font-display text-5xl leading-[1.02] font-semibold tracking-[-0.03em] text-balance sm:text-6xl lg:max-w-none lg:text-7xl">
              Borrow what you need. <span className="text-primary">Lend what you don&apos;t.</span>
            </h1>
            <div className="flex flex-col items-start gap-6 lg:flex-row lg:items-end lg:justify-between">
              <p className="max-w-[52ch] text-lg text-muted-foreground">
                A lending board for your neighborhood. Hang up the tools you rarely use, borrow the
                ones you need once, and always know who has what.
              </p>
              <LandingCta />
            </div>
          </section>

          <section aria-labelledby="board-heading" className="flex flex-col gap-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <h2 id="board-heading" className="font-display text-3xl font-semibold tracking-tight">
                On the board right now
              </h2>
              <p className="text-sm text-muted-foreground">Grouped by category</p>
            </div>
            <PublicToolBoard />
          </section>

          <section aria-labelledby="how-heading" className="flex flex-col gap-6">
            <h2 id="how-heading" className="font-display text-2xl font-semibold tracking-tight">
              How the loop works
            </h2>
            <ol className="grid gap-6 sm:grid-cols-3 sm:gap-8">
              {STEPS.map((step, i) => (
                <li key={step.title} className="grid grid-cols-[2.25rem_1fr] gap-x-4">
                  <span
                    aria-hidden
                    className="flex size-9 items-center justify-center rounded-full bg-secondary font-display text-lg font-semibold text-primary tabular-nums"
                  >
                    {i + 1}
                  </span>
                  <div className="flex flex-col gap-1 pt-1">
                    <h3 className="font-medium">{step.title}</h3>
                    <p className="text-sm text-pretty text-muted-foreground">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <section id="under-the-hood" aria-labelledby="hood-heading" className="scroll-mt-4 border-t bg-secondary">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-16">
            <div className="flex flex-col items-start gap-4">
              <h2 id="hood-heading" className="font-display text-3xl font-semibold tracking-tight">
                Under the hood
              </h2>
              <p className="text-pretty text-muted-foreground">
                LendLoop is a take-home project. If you&apos;re reviewing it, these are the parts
                worth checking.
              </p>
              <ul className="flex flex-col gap-2 text-sm font-medium">
                <li>
                  <ExternalLink href={`${REPO_URL}/blob/main/docs/ARCHITECTURE.md`}>
                    Architecture and security notes
                  </ExternalLink>
                </li>
                <li>
                  <ExternalLink href={`${REPO_URL}#quickstart`}>Run it locally in 10 commands</ExternalLink>
                </li>
              </ul>
            </div>
            <dl className="grid gap-x-10 sm:grid-cols-2">
              {MECHANISMS.map((item) => (
                <div key={item.title} className="flex flex-col gap-1.5 border-t border-border py-5">
                  <dt className="font-medium">{item.title}</dt>
                  <dd className="text-sm text-pretty text-muted-foreground">{item.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:px-6">
          <p>The demo neighbors on the board are fictional.</p>
          <ExternalLink href={REPO_URL}>Source on GitHub</ExternalLink>
        </div>
      </footer>
    </div>
  );
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1 rounded-sm text-foreground underline decoration-primary/60 underline-offset-4 hover:decoration-primary"
    >
      {children}
      <ArrowUpRightIcon aria-hidden className="size-3.5 text-primary" />
    </a>
  );
}
