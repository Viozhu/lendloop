import type { ReactNode } from "react";
import type { ActivityItem } from "@convex/lib/activity";
import type { LoanStatus } from "@convex/lib/validators";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDay } from "@/lib/format";
import { ActivityFeed } from "./activity-feed";
import { LoanStatusBadge } from "./loan-status-badge";

export type LoanCardData = {
  status: LoanStatus;
  startDate: string;
  endDate: string;
  isOverdue: boolean;
  activity?: ActivityItem[];
};

/** Shared layout for a loan seen by either party. */
export function LoanCard({
  loan,
  title,
  counterpart,
  actions,
}: {
  loan: LoanCardData;
  title: string;
  counterpart: string;
  actions?: ReactNode;
}) {
  const dates =
    loan.startDate === loan.endDate
      ? formatDay(loan.startDate)
      : `${formatDay(loan.startDate)} – ${formatDay(loan.endDate)}`;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {title}
          <LoanStatusBadge status={loan.status} isOverdue={loan.isOverdue} />
        </CardTitle>
        <CardDescription>
          {counterpart} · {dates}
        </CardDescription>
        {actions && <CardAction className="flex flex-wrap justify-end gap-1">{actions}</CardAction>}
      </CardHeader>
      {loan.activity && loan.activity.length > 0 && (
        <CardContent>
          <ActivityFeed items={loan.activity} />
        </CardContent>
      )}
    </Card>
  );
}

export function LoanListSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-20 rounded-xl" />
      ))}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center">
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
