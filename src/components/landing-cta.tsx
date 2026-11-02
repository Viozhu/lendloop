"use client";

import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function LandingCta() {
  return (
    <>
      <AuthLoading>
        <Skeleton className="h-9 w-48" />
      </AuthLoading>
      <Unauthenticated>
        <SignInButton mode="modal" fallbackRedirectUrl="/tools">
          <Button size="lg">Sign in to lend or borrow</Button>
        </SignInButton>
      </Unauthenticated>
      <Authenticated>
        <Link href="/tools" className={buttonVariants({ size: "lg" })}>
          Browse tools
        </Link>
      </Authenticated>
    </>
  );
}
