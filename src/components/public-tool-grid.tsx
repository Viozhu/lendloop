"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORY_LABELS } from "@/lib/labels";

/** Read-only grid for signed-out visitors: name and category only. */
export function PublicToolGrid() {
  const tools = useQuery(api.tools.listPublic);

  if (tools === undefined) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  if (tools.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        No tools listed yet. Be the first neighbor to lend one.
      </p>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tools.map((tool) => (
        <li key={tool._id}>
          <Card size="sm">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="truncate">{tool.name}</CardTitle>
              <Badge variant="secondary">{CATEGORY_LABELS[tool.category]}</Badge>
            </CardHeader>
          </Card>
        </li>
      ))}
    </ul>
  );
}
