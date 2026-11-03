import Link from "next/link";
import { cn } from "@/lib/utils";

/** Two linked rings: a tool passing from one neighbor to the next and back. */
function LoopMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      aria-hidden
      className={className}
    >
      <rect x="2" y="3" width="17" height="14" rx="7" />
      <rect x="13" y="3" width="17" height="14" rx="7" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex items-center gap-2 rounded-md font-display text-xl font-semibold tracking-tight",
        className,
      )}
    >
      <LoopMark className="h-5 w-8 text-primary" />
      LendLoop
    </Link>
  );
}
