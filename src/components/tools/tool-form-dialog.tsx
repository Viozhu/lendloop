"use client";

import { useState, type FormEvent, type ReactElement } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { TOOL_DESCRIPTION_MAX, toolInputSchema, type ToolInput } from "@convex/lib/toolInput";
import { TOOL_CATEGORIES, TOOL_CONDITIONS } from "@convex/lib/validators";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { friendlyError } from "@/lib/errors";
import { CATEGORY_LABELS, CONDITION_LABELS } from "@/lib/labels";

type FieldErrors = Partial<Record<keyof ToolInput, string>>;

const EMPTY: ToolInput = { name: "", category: "power_tools", condition: "good", description: "" };
const categoryItems = TOOL_CATEGORIES.map((value) => ({ value, label: CATEGORY_LABELS[value] }));
const conditionItems = TOOL_CONDITIONS.map((value) => ({ value, label: CONDITION_LABELS[value] }));

/** Create a listing, or edit one when `tool` is passed. */
export function ToolFormDialog({
  trigger,
  tool,
}: {
  trigger: ReactElement;
  tool?: ToolInput & { _id: Id<"tools"> };
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<ToolInput>(tool ?? EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const createTool = useMutation(api.tools.create);
  const updateTool = useMutation(api.tools.update);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setValues(tool ?? EMPTY);
      setErrors({});
    }
  }

  function set<K extends keyof ToolInput>(key: K, value: ToolInput[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    // Same schema the server enforces, run here only for inline feedback.
    const parsed = toolInputSchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof ToolInput;
        fieldErrors[key] ??= issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      if (tool) {
        await updateTool({ toolId: tool._id, ...parsed.data });
        toast.success("Listing updated");
      } else {
        await createTool(parsed.data);
        toast.success("Tool listed");
      }
      setOpen(false);
    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{tool ? "Edit listing" : "List a tool"}</DialogTitle>
            <DialogDescription>
              Neighbors see the name, category, condition and description.
            </DialogDescription>
          </DialogHeader>

          <Field label="Name" htmlFor="tool-name" error={errors.name}>
            <Input
              id="tool-name"
              value={values.name}
              onChange={(e) => set("name", e.target.value)}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "tool-name-error" : undefined}
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Category" htmlFor="tool-category">
              <Select
                items={categoryItems}
                value={values.category}
                onValueChange={(v) => v && set("category", v)}
              >
                <SelectTrigger id="tool-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoryItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Condition" htmlFor="tool-condition">
              <Select
                items={conditionItems}
                value={values.condition}
                onValueChange={(v) => v && set("condition", v)}
              >
                <SelectTrigger id="tool-condition" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {conditionItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field
            label="Description"
            htmlFor="tool-description"
            error={errors.description}
            hint={`${values.description.length}/${TOOL_DESCRIPTION_MAX}`}
          >
            <Textarea
              id="tool-description"
              value={values.description}
              onChange={(e) => set("description", e.target.value)}
              aria-invalid={!!errors.description}
              aria-describedby={errors.description ? "tool-description-error" : undefined}
              rows={4}
            />
          </Field>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : tool ? "Save changes" : "List tool"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactElement;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <Label htmlFor={htmlFor}>{label}</Label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
      {error && (
        <p id={`${htmlFor}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
