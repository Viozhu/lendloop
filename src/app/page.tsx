import { LandingCta } from "@/components/landing-cta";
import { PublicToolBoard } from "@/components/public-tool-board";
import { Wordmark } from "@/components/wordmark";

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
    title: "The owner says yes, you get an email",
    body: "Approvals, reminders and returns arrive by email, so nobody has to chase anyone.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center px-4 py-5 sm:px-6">
        <Wordmark />
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-16 px-4 pt-8 pb-20 sm:gap-20 sm:px-6 sm:pt-14">
        <section className="grid items-start gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16">
          <div className="flex flex-col items-start gap-6">
            <h1 className="font-display text-5xl leading-[1.02] font-semibold tracking-[-0.03em] text-balance sm:text-6xl lg:text-7xl">
              Borrow what you need. <span className="text-primary">Lend what you don&apos;t.</span>
            </h1>
            <p className="max-w-[46ch] text-lg text-muted-foreground">
              A lending board for your neighborhood. Hang up the tools you rarely use, borrow the
              ones you need once, and always know who has what.
            </p>
            <LandingCta />
          </div>

          <section aria-labelledby="how-heading" className="flex flex-col gap-5 lg:pt-3">
            <h2 id="how-heading" className="font-display text-2xl font-semibold tracking-tight">
              How the loop works
            </h2>
            <ol className="flex flex-col gap-5">
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
                    <p className="text-sm text-muted-foreground">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </section>

        <section aria-labelledby="board-heading" className="flex flex-col gap-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h2 id="board-heading" className="font-display text-3xl font-semibold tracking-tight">
              On the board right now
            </h2>
            <p className="text-sm text-muted-foreground">Newest first, grouped by category</p>
          </div>
          <PublicToolBoard />
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:px-6">
          <p>LendLoop is a take-home project. The demo neighbors are fictional.</p>
          <a
            href="https://github.com/Viozhu/lendloop"
            className="rounded-sm font-medium text-foreground underline decoration-primary/60 underline-offset-4 hover:decoration-primary"
          >
            Source on GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
