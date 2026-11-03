"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { ConfirmButton } from "@/components/confirm-button";
import { EmptyState, LoanCard, LoanListSkeleton } from "./loan-card";

export function MyRequests() {
  const loans = useQuery(api.loans.listMyRequests);
  const cancel = useMutation(api.loans.cancel);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">My requests</h1>
      {loans === undefined ? (
        <LoanListSkeleton />
      ) : loans.length === 0 ? (
        <EmptyState
          title="No requests yet"
          body="Find something on the Tools board and ask to borrow it."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {loans.map((loan) => (
            <li key={loan._id}>
              <LoanCard
                loan={loan}
                title={loan.tool.name}
                counterpart={`From ${loan.lender.firstName}`}
                actions={
                  loan.status === "pending" && (
                    <ConfirmButton
                      label="Cancel request"
                      title="Cancel this request?"
                      description={`${loan.lender.firstName} will be told you no longer need it.`}
                      confirmLabel="Cancel request"
                      successMessage="Request cancelled"
                      destructive
                      onConfirm={() => cancel({ loanId: loan._id })}
                    />
                  )
                }
              />
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-muted-foreground">
        Looking for something else?{" "}
        <Link href="/tools" className="underline underline-offset-4">
          Browse tools
        </Link>
      </p>
    </div>
  );
}
