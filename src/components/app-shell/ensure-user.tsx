"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Upserts the caller's user row once Convex has validated the Clerk token, and
 * holds the page until then so queries that require a stored user don't race it.
 */
export function EnsureUser({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const storeUser = useMutation(api.users.store);
  const [state, setState] = useState<"pending" | "ready" | "failed">("pending");

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    storeUser()
      .then(() => !cancelled && setState("ready"))
      .catch(() => !cancelled && setState("failed"));
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, storeUser]);

  // Signed out or token expired: never keep rendering pages from a past session.
  if (state === "ready" && isAuthenticated) return children;

  if (state === "failed" || (!isLoading && !isAuthenticated)) {
    return (
      <p role="alert" className="rounded-xl border p-6 text-sm text-muted-foreground">
        We couldn&apos;t confirm your session with the server. Try signing out and back in.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
