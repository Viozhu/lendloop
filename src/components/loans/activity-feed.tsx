"use client";

import { formatDistanceToNow } from "date-fns";
import type { ActivityItem } from "@convex/lib/activity";
import { cn } from "@/lib/utils";

const DOT: Record<ActivityItem["tone"], string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  error: "bg-destructive",
};

/** "Lender notified 3 hours ago", newest first. Renders nothing without activity. */
export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) return null;
  return (
    <ul aria-label="Activity" className="flex flex-col gap-1 text-xs text-muted-foreground">
      {items.map((item) => (
        <li key={`${item.label}-${item.at}`} className="flex items-center gap-2">
          <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", DOT[item.tone])} />
          <span>
            {item.label}{" "}
            <time dateTime={new Date(item.at).toISOString()}>
              {formatDistanceToNow(item.at, { addSuffix: true })}
            </time>
          </span>
        </li>
      ))}
    </ul>
  );
}
