import { daysBetween, isIsoDate } from "./dates";

export const MAX_LOAN_DAYS = 30;

/**
 * Date rules for a borrow request, shared by the request dialog (inline
 * feedback) and loans.request (the authority). Returns a user-facing message,
 * or null when the range is valid.
 */
export function loanDatesError(startDate: string, endDate: string, today: string): string | null {
  if (!isIsoDate(startDate) || !isIsoDate(endDate)) return "Pick valid dates";
  if (startDate < today) return "The start date can't be in the past";
  if (endDate < startDate) return "The end date must be on or after the start date";
  if (daysBetween(startDate, endDate) + 1 > MAX_LOAN_DAYS) {
    return `Loans can last at most ${MAX_LOAN_DAYS} days`;
  }
  return null;
}
