"use client";

import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { friendlyError } from "@/lib/errors";
import { EmptyState, LoanCard, LoanListSkeleton } from "./loan-card";

export function IncomingRequests() {
  const loans = useQuery(api.loans.listIncoming);
  const approve = useMutation(api.loans.approve);
  const decline = useMutation(api.loans.decline);
  const markReturned = useMutation(api.loans.markReturned);

  async function handleApprove(loanId: Id<"loans">) {
    try {
      await approve({ loanId });
      toast.success("Approved. The borrower has been notified.");
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }

  if (loans === undefined) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">Incoming</h1>
        <LoanListSkeleton />
      </>
    );
  }

  const pending = loans.filter((l) => l.status === "pending");
  const active = loans.filter((l) => l.status === "approved");
  const history = loans.filter((l) => l.status !== "pending" && l.status !== "approved");

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">Incoming</h1>
      {loans.length === 0 && (
        <EmptyState
          title="No requests for your tools yet"
          body="When a neighbor asks to borrow something you listed, it shows up here."
        />
      )}

      <Section title="Waiting for you" items={pending}>
        {(loan) => (
          <LoanCard
            loan={loan}
            title={loan.tool.name}
            counterpart={`${loan.borrower.firstName} wants it`}
            actions={
              <>
                {loan.conflictsWithApproved ? (
                  <Tooltip>
                    {/* Disabled buttons don't fire pointer events, so the span carries the tooltip. */}
                    <TooltipTrigger render={<span tabIndex={0} />}>
                      <Button size="sm" disabled>
                        Approve
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Overlaps a loan you already approved</TooltipContent>
                  </Tooltip>
                ) : (
                  <Button size="sm" onClick={() => handleApprove(loan._id)}>
                    Approve
                  </Button>
                )}
                <ConfirmButton
                  label="Decline"
                  title="Decline this request?"
                  description={`${loan.borrower.firstName} will be notified.`}
                  successMessage="Request declined"
                  onConfirm={() => decline({ loanId: loan._id })}
                />
              </>
            }
          />
        )}
      </Section>

      <Section title="Out on loan" items={active}>
        {(loan) => (
          <LoanCard
            loan={loan}
            title={loan.tool.name}
            counterpart={`With ${loan.borrower.firstName}`}
            actions={
              <ConfirmButton
                label="Mark returned"
                variant="outline"
                title={`Got your ${loan.tool.name} back?`}
                description="This closes the loan and makes the tool available again."
                successMessage="Marked as returned"
                onConfirm={() => markReturned({ loanId: loan._id })}
              />
            }
          />
        )}
      </Section>

      <Section title="History" items={history}>
        {(loan) => (
          <LoanCard loan={loan} title={loan.tool.name} counterpart={loan.borrower.firstName} />
        )}
      </Section>
    </div>
  );
}

function Section<T extends { _id: string }>({
  title,
  items,
  children,
}: {
  title: string;
  items: T[];
  children: (item: T) => React.ReactNode;
}) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <h2 className="text-sm font-medium text-muted-foreground">
        {title} ({items.length})
      </h2>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item._id}>{children(item)}</li>
        ))}
      </ul>
    </section>
  );
}
