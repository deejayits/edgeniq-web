"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";
import {
  TARGET_TYPE_LABEL,
  type SmartMoneyTarget,
  type TargetType,
} from "../types";

const TYPE_ACCENT: Record<TargetType, string> = {
  fund_13f: "bg-emerald-400/15 text-emerald-300 border-emerald-400/30",
  insider: "bg-primary/15 text-primary border-primary/30",
  activist: "bg-amber-400/15 text-amber-300 border-amber-400/30",
};

function initials(n: string): string {
  return n
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Picker that drives the /compare URL. Up to 3 simultaneous targets.
// Writing to the URL (not local state) means the comparison table on
// the server component re-renders with fresh data every time — no
// separate state sync needed.
export function ComparePicker({
  targets,
  selectedIds,
}: {
  targets: SmartMoneyTarget[];
  selectedIds: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");

  const selected = selectedIds
    .map((id) => targets.find((t) => t.id === id))
    .filter((t): t is SmartMoneyTarget => !!t);
  const selectedSet = new Set(selectedIds);

  const filtered = targets
    .filter((t) => !selectedSet.has(t.id))
    .filter((t) =>
      query.trim() === ""
        ? true
        : (t.display_name + " " + (t.subtitle ?? ""))
            .toLowerCase()
            .includes(query.toLowerCase()),
    )
    .slice(0, 12);

  const setUrl = (ids: string[]) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.delete("ids");
    for (const id of ids) params.append("ids", id);
    router.push(`/app/smart-money/compare?${params.toString()}`);
  };

  const add = (id: string) => {
    if (selected.length >= 3) return;
    setUrl([...selectedIds, id]);
  };
  const remove = (id: string) => {
    setUrl(selectedIds.filter((x) => x !== id));
  };

  return (
    <Card className="p-5 border-border/60 bg-card/40 space-y-4">
      <div>
        <h3 className="text-sm font-medium">Pick up to 3 to compare</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Side-by-side portfolio overlap + activity rhythm.
        </p>
      </div>

      {/* Selected pills */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((t) => (
            <button
              key={t.id}
              onClick={() => remove(t.id)}
              className="inline-flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs hover:bg-primary/20 transition group"
            >
              <span className="h-5 w-5 rounded-full bg-gradient-to-br from-emerald-400/30 to-violet-400/30 border border-primary/40 flex items-center justify-center text-[9px] font-semibold">
                {initials(t.display_name)}
              </span>
              <span className="font-medium">{t.display_name}</span>
              <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
            </button>
          ))}
        </div>
      )}

      {/* Search + add */}
      {selected.length < 3 && (
        <div className="space-y-2">
          <Input
            placeholder="Search funds, insiders…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9"
          />
          <div className="max-h-64 overflow-y-auto space-y-1 pr-1 -mr-1">
            {filtered.map((t) => (
              <button
                key={t.id}
                onClick={() => add(t.id)}
                className="w-full flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left hover:bg-muted/40 transition text-sm"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="h-7 w-7 rounded-md bg-gradient-to-br from-emerald-400/15 to-violet-400/15 border border-border/60 flex items-center justify-center text-[10px] font-semibold shrink-0">
                    {initials(t.display_name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate">{t.display_name}</p>
                    {t.subtitle && (
                      <p className="text-[10px] text-muted-foreground truncate">
                        {t.subtitle}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant="outline"
                    className={`text-[10px] py-0 h-4 ${TYPE_ACCENT[t.target_type]}`}
                  >
                    {TARGET_TYPE_LABEL[t.target_type]}
                  </Badge>
                  <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">
                No matches.
              </p>
            )}
          </div>
        </div>
      )}

      {selected.length > 0 && (
        <div className="flex items-center justify-between pt-2 border-t border-border/60">
          <p className="text-xs text-muted-foreground">
            {selected.length} of 3 selected
          </p>
          <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
            <Link href="/app/smart-money/compare">Clear all</Link>
          </Button>
        </div>
      )}
    </Card>
  );
}
