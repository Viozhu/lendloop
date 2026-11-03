"use client";

import type { ReactNode } from "react";
import { useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { CircleCheckIcon } from "lucide-react";
import { api } from "@convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Failed or retrying automation, so nothing fails silently. */
export function AutomationHealth() {
  const health = useQuery(api.admin.automationHealth);
  if (health === undefined) return <Skeleton className="h-64 w-full rounded-xl" />;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel
        title="Failed notifications"
        description="Gave up after 4 attempts. Check n8n and Mailpit, then re-trigger the action."
        count={health.failedNotifications.length}
        severity="error"
      >
        {health.failedNotifications.map((n) => (
          <Row key={n._id} at={n.at} title={`${n.type} · ${n.toolName}`} detail={n.lastError ?? undefined} />
        ))}
      </Panel>

      <Panel
        title="Retrying notifications"
        description="Failed at least once; the outbox will try again."
        count={health.retryingNotifications.length}
        severity="warn"
      >
        {health.retryingNotifications.map((n) => (
          <Row
            key={n._id}
            at={n.at}
            title={`${n.type} · ${n.toolName} · attempt ${n.attempts + 1} of 4`}
            detail={
              n.nextAttemptAt
                ? `${n.lastError ?? "Failed"}. Next try ${formatDistanceToNow(n.nextAttemptAt, { addSuffix: true })}`
                : (n.lastError ?? undefined)
            }
          />
        ))}
      </Panel>

      <Panel
        title="Failed reminders"
        description="The reminder email failed; the next daily run retries it."
        count={health.failedReminders.length}
        severity="warn"
      >
        {health.failedReminders.map((r) => (
          <Row
            key={r._id}
            at={r.at}
            title={`${r.toolName} · ${r.day}`}
            detail={r.executionId ? `n8n execution ${r.executionId}` : undefined}
          />
        ))}
      </Panel>

      <Panel
        title="Workflow errors"
        description="Reported by the n8n error workflow."
        count={health.workflowErrors.length}
        severity="error"
      >
        {health.workflowErrors.map((e) => (
          <Row
            key={e._id}
            at={e.at}
            title={e.message}
            detail={e.executionId ? `n8n execution ${e.executionId}` : undefined}
          />
        ))}
      </Panel>
    </div>
  );
}

function Panel({
  title,
  description,
  count,
  severity,
  children,
}: {
  title: string;
  description: string;
  count: number;
  severity: "warn" | "error";
  children: ReactNode;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {title}
          {count > 0 && (
            <Badge
              variant={severity === "error" ? "destructive" : "outline"}
              className={severity === "warn" ? "border-amber-500/50 text-amber-700 dark:text-amber-400" : undefined}
            >
              {count}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {count === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CircleCheckIcon className="size-4 text-emerald-600" aria-hidden />
            All clear
          </p>
        ) : (
          <ul className="flex flex-col divide-y">{children}</ul>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ title, detail, at }: { title: string; detail?: string; at: number }) {
  return (
    <li className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium break-words">{title}</span>
        <time className="shrink-0 text-xs text-muted-foreground" dateTime={new Date(at).toISOString()}>
          {formatDistanceToNow(at, { addSuffix: true })}
        </time>
      </div>
      {detail && <span className="text-xs break-words text-muted-foreground">{detail}</span>}
    </li>
  );
}
