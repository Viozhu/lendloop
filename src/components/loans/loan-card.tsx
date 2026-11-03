import type { ReactNode } from "react";
import type { LoanStatus } from "@convex/lib/validators";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDay } from "@/lib/format";
import { LoanStatusBadge } from "./loan-status-badge";

export type LoanCardData = {
  status: LoanStatus;
  startDate: string;
  endDate: string;
  isOverdue: boolean;
};

/** Shared layout for a loan seen by either party. */
export function LoanCard({
  loan,
  title,
  counterpart,
  actions,
  children,
}: {
  loan: LoanCardData;
  title: string;
  counterpart: string;
  actions?: ReactNode;
  children?: ReactNode;
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
      {children && <CardContent>{children}</CardContent>}
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
