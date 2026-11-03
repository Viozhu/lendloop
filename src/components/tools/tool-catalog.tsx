"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { BadgeCheckIcon } from "lucide-react";
import { api } from "@convex/_generated/api";
import { TOOL_CATEGORIES, type ToolCategory } from "@convex/lib/validators";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORY_LABELS, CONDITION_LABELS } from "@/lib/labels";
import { RequestLoanDialog } from "@/components/loans/request-loan-dialog";
import { AvailabilityBadge } from "./availability-badge";
import { CategoryFilter } from "./category-filter";

function parseCategory(raw: string | null): ToolCategory | undefined {
  return TOOL_CATEGORIES.find((c) => c === raw);
}

export function ToolCatalog() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const category = parseCategory(searchParams.get("category"));
  const tools = useQuery(api.tools.list, { category });

  // The filter lives in the URL so it survives reloads and can be shared.
  function setCategory(next: ToolCategory | undefined) {
    const params = new URLSearchParams(searchParams);
    if (next) params.set("category", next);
    else params.delete("category");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Tools</h1>
        <CategoryFilter value={category} onChange={setCategory} />
      </div>

      {tools === undefined ? (
        <div className="grid gap-3 sm:grid-cols-2" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : tools.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {category
            ? `No ${CATEGORY_LABELS[category].toLowerCase()} listed yet.`
            : "No tools listed yet. Add one from My listings."}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {tools.map((tool) => (
            <li key={tool._id}>
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle>{tool.name}</CardTitle>
                    <AvailabilityBadge
                      availability={tool.availability}
                      requestedByMe={tool.requestedByMe}
                    />
                  </div>
                  <CardDescription className="flex flex-wrap items-center gap-1.5">
                    <span>{CATEGORY_LABELS[tool.category]}</span>
                    <span aria-hidden>·</span>
                    <span>{CONDITION_LABELS[tool.condition]} condition</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3">
                  {tool.description && (
                    <p className="line-clamp-3 text-muted-foreground">{tool.description}</p>
                  )}
                  <div className="mt-auto flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {tool.isMine ? (
                      <span>Your listing</span>
                    ) : (
                      <span>Lent by {tool.owner.firstName}</span>
                    )}
                    {tool.owner.trustedLender && (
                      <Badge variant="outline">
                        <BadgeCheckIcon data-icon="inline-start" />
                        Trusted Lender
                      </Badge>
                    )}
                    {!tool.isMine && !tool.requestedByMe && (
                      <span className="ml-auto">
                        <RequestLoanDialog toolId={tool._id} toolName={tool.name} />
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
