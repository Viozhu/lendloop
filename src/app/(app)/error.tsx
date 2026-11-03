"use client";

import { Button } from "@/components/ui/button";
import { friendlyError } from "@/lib/errors";

export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border p-6">
      <h2 className="font-medium">This page couldn&apos;t load</h2>
      <p className="text-sm text-muted-foreground">{friendlyError(error)}</p>
      <Button variant="outline" onClick={retry}>
        Try again
      </Button>
    </div>
  );
}
