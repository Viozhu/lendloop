"use client";

import { TOOL_CATEGORIES, type ToolCategory } from "@convex/lib/validators";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORY_LABELS } from "@/lib/labels";

const ALL = "all";
const items = [
  { value: ALL, label: "All categories" },
  ...TOOL_CATEGORIES.map((value) => ({ value, label: CATEGORY_LABELS[value] })),
];

export function CategoryFilter({
  value,
  onChange,
}: {
  value: ToolCategory | undefined;
  onChange: (category: ToolCategory | undefined) => void;
}) {
  return (
    <Select
      items={items}
      value={value ?? ALL}
      onValueChange={(next) => onChange(next === ALL || next === null ? undefined : (next as ToolCategory))}
    >
      <SelectTrigger aria-label="Filter by category" className="w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
