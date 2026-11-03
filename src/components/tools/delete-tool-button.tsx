"use client";

import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ConfirmButton } from "@/components/confirm-button";

export function DeleteToolButton({ toolId, name }: { toolId: Id<"tools">; name: string }) {
  const removeTool = useMutation(api.tools.remove);
  return (
    <ConfirmButton
      label="Delete"
      title={`Delete ${name}?`}
      description="It disappears from the board. Past loans stay in your history."
      successMessage={`${name} removed`}
      destructive
      onConfirm={() => removeTool({ toolId })}
    />
  );
}
