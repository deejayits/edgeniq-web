"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Top-nav for /app. Highlights the active route. Kept as a client
// component because usePathname only works in the client tree — but
// the nav items list is static so it's cheap.
const NAV = [
  { href: "/app", label: "Today" },
  { href: "/app/portfolio", label: "Portfolio" },
  { href: "/app/history", label: "History" },
  { href: "/app/settings", label: "Settings" },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 text-sm">
      {NAV.map((item) => {
        const active =
          item.href === "/app"
            ? pathname === "/app"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "px-3 py-1.5 rounded-md transition",
              active
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
