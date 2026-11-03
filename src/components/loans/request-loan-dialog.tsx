"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { format, parseISO } from "date-fns";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { todayUtc } from "@convex/lib/dates";
import { loanDatesError, MAX_LOAN_DAYS } from "@convex/lib/loanRules";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { friendlyError } from "@/lib/errors";
import { formatDay } from "@/lib/format";

const toIso = (date: Date) => format(date, "yyyy-MM-dd");

export function RequestLoanDialog({ toolId, toolName }: { toolId: Id<"tools">; toolName: string }) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const requestLoan = useMutation(api.loans.request);

  // Same "today" the server uses, so the picker and the backend agree.
  const today = todayUtc();
  const startDate = range?.from ? toIso(range.from) : undefined;
  const endDate = range?.to ? toIso(range.to) : startDate;
  const error = startDate && endDate ? loanDatesError(startDate, endDate, today) : null;

  async function handleSubmit() {
    if (!startDate || !endDate || error) return;
    setSubmitting(true);
    try {
      await requestLoan({ toolId, startDate, endDate });
      toast.success(`Request sent. We'll let you know when the lender answers.`);
      setOpen(false);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setRange(undefined);
      }}
    >
      <DialogTrigger render={<Button size="sm" />}>Request to borrow</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Borrow {toolName}</DialogTitle>
          <DialogDescription>
            Pick the days you need it, up to {MAX_LOAN_DAYS} days. Tap one day for a single-day loan.
          </DialogDescription>
        </DialogHeader>

        <Calendar
          mode="range"
          selected={range}
          onSelect={setRange}
          disabled={{ before: parseISO(today) }}
          className="mx-auto"
        />

        <p className="min-h-5 text-sm" aria-live="polite">
          {error ? (
            <span className="text-destructive">{error}</span>
          ) : startDate && endDate ? (
            <span className="text-muted-foreground">
              {startDate === endDate
                ? formatDay(startDate)
                : `${formatDay(startDate)} – ${formatDay(endDate)}`}
            </span>
          ) : (
            <span className="text-muted-foreground">No dates selected yet</span>
          )}
        </p>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={!startDate || !!error || submitting}>
            {submitting ? "Sending…" : "Send request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
