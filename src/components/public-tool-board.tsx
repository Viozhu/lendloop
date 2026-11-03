"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Authenticated, Unauthenticated, useConvexConnectionState, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { TOOL_CATEGORIES } from "@convex/lib/validators";
import { QueryErrorBoundary } from "@/components/query-error-boundary";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORY_LABELS } from "@/lib/labels";

/**
 * The public "board": a pegboard where tools hang as tags, grouped by
 * category. Read-only on purpose (name and category only), so nothing on it
 * looks clickable.
 */
export function PublicToolBoard() {
  return (
    <QueryErrorBoundary
      className="flex flex-col gap-4"
      fallback={(retry) => (
        <Pegboard>
          <div role="alert" className="flex flex-col items-start gap-3 rounded-lg bg-card p-5 shadow-sm">
            <p className="font-medium">The board didn&apos;t load.</p>
            <p className="text-sm text-muted-foreground">
              We couldn&apos;t reach the server. Your connection may be down, or the backend may
              be restarting.
            </p>
            <Button variant="outline" onClick={retry}>
              Try again
            </Button>
          </div>
        </Pegboard>
      )}
    >
      <BoardContents />
    </QueryErrorBoundary>
  );
}

function BoardContents() {
  const board = useQuery(api.tools.listPublic);
  const connection = useConvexConnectionState();

  if (board === undefined) {
    // An unreachable backend doesn't throw; the client keeps retrying. Say so
    // instead of showing a skeleton forever.
    if (!connection.isWebSocketConnected && connection.connectionRetries >= 2) {
      return (
        <Pegboard>
          <div role="status" className="rounded-lg bg-card p-5 shadow-sm">
            <p className="font-medium">Can&apos;t reach the board right now.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Still trying to connect. It will load on its own once the server is back.
            </p>
          </div>
        </Pegboard>
      );
    }
    return (
      <Pegboard busy>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-24 bg-board-hole/60" />
              <Skeleton className="h-11 rounded-md bg-card/70" />
              <Skeleton className="h-11 rounded-md bg-card/70" />
            </div>
          ))}
        </div>
      </Pegboard>
    );
  }

  if (board.tools.length === 0) {
    return (
      <Pegboard>
        <div className="rounded-lg bg-card p-5 shadow-sm">
          <p className="font-medium">The board is empty for now.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Be the first neighbor to hang something up. Sign in and list a tool.
          </p>
        </div>
      </Pegboard>
    );
  }

  const groups = TOOL_CATEGORIES.map((category) => ({
    category,
    tools: board.tools.filter((tool) => tool.category === category),
  })).filter((group) => group.tools.length > 0);

  return (
    <>
      <Pegboard>
        <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map(({ category, tools }) => (
            <section key={category} aria-label={CATEGORY_LABELS[category]} className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-board-foreground">
                {CATEGORY_LABELS[category]}{" "}
                <span className="font-normal tabular-nums">({tools.length})</span>
              </h3>
              <ul className="flex flex-col gap-2">
                {tools.map((tool) => (
                  <li
                    key={tool._id}
                    className="flex min-h-11 items-center gap-3 rounded-md bg-card px-3 py-2 text-sm text-card-foreground shadow-[0_1px_2px_oklch(0.4_0.04_55/0.18)]"
                  >
                    {/* The punched hole of a hang tag. */}
                    <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-board ring-1 ring-board-hole" />
                    <span className="line-clamp-2 min-w-0 break-words">{tool.name}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Pegboard>
      <p className="text-sm text-muted-foreground">
        {board.hasMore && <>Showing the {board.tools.length} newest tools. </>}
        <Unauthenticated>
          Sign in to see {board.hasMore ? "the whole board, " : ""}who&apos;s lending each tool and
          when it&apos;s free.
        </Unauthenticated>
        <Authenticated>
          <Link href="/tools" className="font-medium text-foreground underline decoration-primary/60 underline-offset-4 hover:decoration-primary">
            Open Tools
          </Link>{" "}
          to see who&apos;s lending each one and request it.
        </Authenticated>
      </p>
    </>
  );
}

/** Kraft panel with a peg-hole grid, the board everything hangs on. */
function Pegboard({ children, busy = false }: { children: ReactNode; busy?: boolean }) {
  return (
    <div
      aria-busy={busy || undefined}
      className="rounded-2xl bg-board bg-[radial-gradient(circle,var(--board-hole)_1.5px,transparent_1.75px)] bg-size-[20px_20px] p-5 sm:p-8"
    >
      {children}
    </div>
  );
}
