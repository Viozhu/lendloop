import { LandingCta } from "@/components/landing-cta";
import { PublicToolGrid } from "@/components/public-tool-grid";

export default function LandingPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-4 py-16 sm:py-24">
      <section className="flex flex-col items-start gap-5">
        <p className="text-sm font-medium text-muted-foreground">LendLoop</p>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Borrow what you need. Lend what you don&apos;t.
        </h1>
        <p className="max-w-xl text-base text-muted-foreground">
          A lending board for your neighborhood. List the drill gathering dust, borrow the
          ladder you need once a year, and keep track of who has what.
        </p>
        <LandingCta />
      </section>

      <section aria-labelledby="available-heading" className="flex flex-col gap-4">
        <h2 id="available-heading" className="text-lg font-medium">
          On the board right now
        </h2>
        <PublicToolGrid />
      </section>
    </main>
  );
}
