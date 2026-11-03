"use client";

import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// One footprint for every auth state, so the hero doesn't shift when auth
// resolves; 44px tall for comfortable touch targets.
const CTA_SIZE = "h-11 min-w-60 px-5 text-base";

export function LandingCta() {
  return (
    <>
      <AuthLoading>
        <Skeleton className={cn(CTA_SIZE, "rounded-lg")} />
      </AuthLoading>
      <Unauthenticated>
        <SignInButton mode="modal" fallbackRedirectUrl="/tools">
          <Button className={CTA_SIZE}>Sign in to lend or borrow</Button>
        </SignInButton>
      </Unauthenticated>
      <Authenticated>
        <Link href="/tools" className={cn(buttonVariants(), CTA_SIZE)}>
          Browse tools
        </Link>
      </Authenticated>
    </>
  );
}
