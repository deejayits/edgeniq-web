"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  BarChart3,
  Briefcase,
  History as HistoryIcon,
  LogOut,
  Home,
  Settings,
  BookOpen,
  MessageSquare,
} from "lucide-react";

// Global command palette. Triggered by ⌘K / Ctrl+K. Mounted once in the
// /app layout so every dashboard page gets the same hotkey.
//
// Kept simple for now — static command list with router.push() actions.
// When real data is wired we can add a search-as-you-type index of
// tickers / trades / signals.
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const go = (path: string) => () => {
    setOpen(false);
    router.push(path);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command menu"
      description="Jump to any dashboard page, open a Telegram command, or sign out."
    >
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>
        <CommandGroup heading="Navigate">
          <CommandItem onSelect={go("/app")}>
            <Home className="h-4 w-4" />
            Today
            <CommandShortcut>G T</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={go("/app/portfolio")}>
            <Briefcase className="h-4 w-4" />
            Portfolio
            <CommandShortcut>G P</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={go("/app/history")}>
            <HistoryIcon className="h-4 w-4" />
            History
            <CommandShortcut>G H</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={go("/app/settings")}>
            <Settings className="h-4 w-4" />
            Settings
            <CommandShortcut>G S</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Telegram">
          <CommandItem
            onSelect={() => {
              window.open("https://t.me/edgeniq_alerts_bot", "_blank");
              setOpen(false);
            }}
          >
            <MessageSquare className="h-4 w-4" />
            Open @edgeniq_alerts_bot
          </CommandItem>
          <CommandItem
            onSelect={() => {
              window.open("https://t.me/EdgeNiqSupport", "_blank");
              setOpen(false);
            }}
          >
            <MessageSquare className="h-4 w-4" />
            Message @EdgeNiqSupport
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Resources">
          <CommandItem onSelect={go("/legal/terms")}>
            <BookOpen className="h-4 w-4" />
            Terms of Service
          </CommandItem>
          <CommandItem onSelect={go("/legal/privacy")}>
            <BookOpen className="h-4 w-4" />
            Privacy Policy
          </CommandItem>
          <CommandItem onSelect={go("/brand")}>
            <BarChart3 className="h-4 w-4" />
            Brand assets
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Account">
          <CommandItem
            onSelect={() => {
              setOpen(false);
              signOut({ callbackUrl: "/" });
            }}
          >
            <LogOut className="h-4 w-4" />
            Log out
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
