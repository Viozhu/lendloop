"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/tools", label: "Tools" },
  { href: "/listings", label: "My listings" },
  { href: "/requests", label: "My requests" },
  { href: "/incoming", label: "Incoming" },
] as const;

export function AppNav() {
  const pathname = usePathname();
  const me = useQuery(api.users.me);
  // Hiding the link is cosmetic; admin functions check the role server-side.
  const items = me?.role === "admin" ? [...NAV_ITEMS, { href: "/admin", label: "Admin" }] : NAV_ITEMS;

  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-6 px-4">
        <Link href="/" className="font-semibold tracking-tight">
          LendLoop
        </Link>
        <nav aria-label="Main" className="flex flex-1 items-center gap-1 overflow-x-auto">
          {items.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  active && "bg-muted text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <UserButton />
      </div>
    </header>
  );
}
