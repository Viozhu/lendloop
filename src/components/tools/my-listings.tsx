"use client";

import { useQuery } from "convex/react";
import { PlusIcon } from "lucide-react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORY_LABELS, CONDITION_LABELS } from "@/lib/labels";
import { AvailabilityBadge } from "./availability-badge";
import { DeleteToolButton } from "./delete-tool-button";
import { ToolFormDialog } from "./tool-form-dialog";

export function MyListings() {
  const tools = useQuery(api.tools.listMine);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">My listings</h1>
        <ToolFormDialog
          trigger={
            <Button>
              <PlusIcon data-icon="inline-start" />
              List a tool
            </Button>
          }
        />
      </div>

      {tools === undefined ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : tools.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">You haven&apos;t listed anything yet</p>
          <p className="text-sm text-muted-foreground">
            That ladder in the garage could save a neighbor a trip to the store.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {tools.map((tool) => (
            <li key={tool._id}>
              <Card size="sm">
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    {tool.name}
                    <AvailabilityBadge availability={tool.availability} />
                  </CardTitle>
                  <CardDescription>
                    {CATEGORY_LABELS[tool.category]} · {CONDITION_LABELS[tool.condition]} condition
                  </CardDescription>
                  <CardAction className="flex gap-1">
                    <ToolFormDialog
                      tool={tool}
                      trigger={
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                      }
                    />
                    <DeleteToolButton toolId={tool._id} name={tool.name} />
                  </CardAction>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
