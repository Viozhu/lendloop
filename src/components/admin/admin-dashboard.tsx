"use client";

import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ConfirmButton } from "@/components/confirm-button";
import { LoanStatusBadge } from "@/components/loans/loan-status-badge";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { friendlyError } from "@/lib/errors";
import { formatDay } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/labels";

export function AdminDashboard() {
  const me = useQuery(api.users.me);

  if (me === undefined) return <Skeleton className="h-40 w-full rounded-xl" />;
  // UX only: every admin query and mutation checks the role on the server.
  if (me?.role !== "admin") {
    return (
      <p role="alert" className="rounded-xl border p-6 text-sm text-muted-foreground">
        This area is for admins only.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
      <Tabs defaultValue="listings">
        <TabsList>
          <TabsTrigger value="listings">Listings</TabsTrigger>
          <TabsTrigger value="loans">Loans</TabsTrigger>
          <TabsTrigger value="neighbors">Neighbors</TabsTrigger>
        </TabsList>
        <TabsContent value="listings" className="pt-4">
          <ListingsTable />
        </TabsContent>
        <TabsContent value="loans" className="pt-4">
          <LoansTable />
        </TabsContent>
        <TabsContent value="neighbors" className="pt-4">
          <NeighborsTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ListingsTable() {
  const listings = useQuery(api.admin.listListings);
  const removeListing = useMutation(api.admin.removeListing);
  if (listings === undefined) return <TableSkeleton />;
  if (listings.length === 0) return <Empty text="No listings yet." />;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tool</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {listings.map((tool) => (
          <TableRow key={tool._id}>
            <TableCell className="font-medium">{tool.name}</TableCell>
            <TableCell>{CATEGORY_LABELS[tool.category]}</TableCell>
            <TableCell>{tool.owner.firstName}</TableCell>
            <TableCell>
              {tool.isActive ? (
                <Badge variant="outline">Active</Badge>
              ) : (
                <Badge variant="secondary">
                  {tool.removedByAdmin ? "Removed by admin" : "Deleted by owner"}
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-right">
              {tool.isActive && (
                <ConfirmButton
                  label="Remove"
                  title={`Remove ${tool.name}?`}
                  description="It's taken off the board and its pending requests are declined. Active loans stay open until returned."
                  successMessage="Listing removed"
                  destructive
                  onConfirm={() => removeListing({ toolId: tool._id })}
                />
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function LoansTable() {
  const loans = useQuery(api.admin.listLoans);
  if (loans === undefined) return <TableSkeleton />;
  if (loans.length === 0) return <Empty text="No loans yet." />;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tool</TableHead>
          <TableHead>Lender</TableHead>
          <TableHead>Borrower</TableHead>
          <TableHead>Dates</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loans.map((loan) => (
          <TableRow key={loan._id}>
            <TableCell className="font-medium">{loan.tool.name}</TableCell>
            <TableCell>{loan.lender.firstName}</TableCell>
            <TableCell>{loan.borrower.firstName}</TableCell>
            <TableCell className="whitespace-nowrap">
              {formatDay(loan.startDate)} – {formatDay(loan.endDate)}
            </TableCell>
            <TableCell>
              <LoanStatusBadge status={loan.status} isOverdue={loan.isOverdue} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function NeighborsTable() {
  const users = useQuery(api.admin.listUsers);
  const setTrusted = useMutation(api.admin.setTrustedLender);

  async function toggle(userId: Id<"users">, trustedLender: boolean) {
    try {
      await setTrusted({ userId, trustedLender });
      toast.success(trustedLender ? "Marked as Trusted Lender" : "Trusted Lender removed");
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }

  if (users === undefined) return <TableSkeleton />;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Role</TableHead>
          <TableHead className="text-right">Trusted Lender</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user._id}>
            <TableCell className="font-medium">{user.name}</TableCell>
            <TableCell className="capitalize">{user.role}</TableCell>
            <TableCell className="text-right">
              <Switch
                checked={user.trustedLender}
                onCheckedChange={(checked) => toggle(user._id, checked)}
                aria-label={`Trusted Lender: ${user.name}`}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function TableSkeleton() {
  return <Skeleton className="h-48 w-full rounded-xl" />;
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{text}</p>;
}
