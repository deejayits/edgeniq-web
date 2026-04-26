"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Top-nav for /app. Highlights the active route. Kept as a client
// component because usePathname only works in the client tree — but
// the nav items list is static so it's cheap. isAdmin is passed from
// the server layout since session reads belong in server components.
const BASE_NAV = [
  { href: "/app", label: "Today" },
  { href: "/app/portfolio", label: "Portfolio" },
  { href: "/app/smart-money", label: "Smart Money" },
  { href: "/app/broker", label: "Auto-trade" },
  { href: "/app/history", label: "History" },
  { href: "/app/backtest", label: "Backtest" },
  { href: "/app/commands", label: "Commands" },
  { href: "/app/settings", label: "Settings" },
];

const ADMIN_NAV = [{ href: "/app/admin/users", label: "Users" }];

export function AppNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const items = isAdmin ? [...BASE_NAV, ...ADMIN_NAV] : BASE_NAV;
  return (
    <nav className="flex items-center gap-0.5 text-sm">
      {items.map((item) => {
        const active =
          item.href === "/app"
            ? pathname === "/app"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative px-3 py-1.5 rounded-md transition-colors duration-150",
              active
                ? "text-foreground bg-muted/60 shadow-[inset_0_1px_0_oklch(1_0_0_/_0.05)]"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
