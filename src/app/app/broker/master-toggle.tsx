"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Power, Zap } from "lucide-react";
import { setMasterAutoTrade } from "./actions";

// Master auto-trade on/off switch — scoped to ONE mode (paper or
// live). Reflects "is ANY rule in this mode currently firing" — on
// if at least one rule has execution_mode='auto' or 'one_tap' for
// that mode, off if all are 'off'. Flipping it batches the update
// across this mode's rules only. Toggling Paper does NOT touch Live
// rules; toggling Live does NOT touch Paper rules.

type Props = {
  mode: "paper" | "live";
  anyActive: boolean;
  activeCount: number;
  totalCount: number;
};

export function AutoTradeMasterToggle({
  mode,
  anyActive,
  activeCount,
  totalCount,
}: Props) {
  const [enabled, setEnabled] = useState(anyActive);
  const [isPending, startTransition] = useTransition();

  const handleToggle = (next: boolean) => {
    // Optimistic: flip the visual immediately; revert on server error.
    setEnabled(next);
    startTransition(async () => {
      const res = await setMasterAutoTrade(next, mode);
      if (res.ok) {
        const modeLabel = mode === "live" ? "Live" : "Paper";
        toast.success(
          next
            ? `${modeLabel} auto-trade ON — rules will execute as signals fire`
            : `${modeLabel} auto-trade OFF — ${modeLabel.toLowerCase()} rules paused`,
        );
      } else {
        setEnabled(!next); // revert
        toast.error(res.error);
      }
    });
  };

  return (
    <Card
      className={`p-6 flex flex-col h-full space-y-4 ${
        enabled
          ? "border-emerald-400/30 bg-emerald-400/5"
          : "border-border/60 bg-card/40"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`h-10 w-10 rounded-md flex items-center justify-center shrink-0 border ${
            enabled
              ? "bg-emerald-400/15 border-emerald-400/30"
              : "bg-muted/40 border-border/60"
          }`}
        >
          {enabled ? (
            <Zap className="h-4 w-4 text-emerald-300" />
          ) : (
            <Power className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium">Auto-trade</h3>
            {enabled ? (
              <Badge className="bg-emerald-400/15 text-emerald-300 border border-emerald-400/30 text-[10px] py-0 h-5">
                {activeCount}/{totalCount} rules active
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-[10px] py-0 h-5 text-muted-foreground"
              >
                Paused
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {enabled
              ? "Orders submit to Alpaca when signals pass your rules + rails."
              : "Flip on to let rules execute automatically when signals fire."}
          </p>
        </div>
      </div>
      <div className="mt-auto pt-2 border-t border-border/40 flex items-center justify-between">
        <span
          className={`text-xs font-semibold uppercase tracking-wider ${
            enabled ? "text-emerald-300" : "text-muted-foreground"
          }`}
        >
          {enabled ? "Enabled" : "Disabled"}
        </span>
        <Switch
          checked={enabled}
          onCheckedChange={handleToggle}
          disabled={isPending}
        />
      </div>
    </Card>
  );
}
