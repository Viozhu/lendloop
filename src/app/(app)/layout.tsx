import { Suspense, type ReactNode } from "react";
import { auth } from "@clerk/nextjs/server";
import { AppNav } from "@/components/app-shell/app-nav";
import { EnsureUser } from "@/components/app-shell/ensure-user";
import { Skeleton } from "@/components/ui/skeleton";

// Every page in this group sets `export const instant = false`: they redirect
// signed-out visitors, which Next's instant-navigation validation would report
// as an error on every page. The opt-out has to be per page, not on the layout.

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <AppNav />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
        {/* auth() reads the request, so Cache Components requires a Suspense boundary. */}
        <Suspense fallback={<PageSkeleton />}>
          <SignedInOnly>
            <EnsureUser>{children}</EnsureUser>
          </SignedInOnly>
        </Suspense>
      </main>
    </div>
  );
}

// Redirects signed-out visitors to sign in. This is a UX guard only: every
// Convex function authorizes the caller itself.
async function SignedInOnly({ children }: { children: ReactNode }) {
  await auth.protect();
  return children;
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
