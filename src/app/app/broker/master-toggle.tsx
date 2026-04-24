"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Power, Zap } from "lucide-react";
import { setMasterAutoTrade } from "./actions";

// Master auto-trade on/off switch. Reflects "is ANY rule currently
// firing orders" — on if at least one rule has execution_mode='auto'
// or 'one_tap', off if all rules are 'off'. Flipping it batches the
// update across all rules for this user.

type Props = {
  anyActive: boolean;
  activeCount: number;
  totalCount: number;
};

export function AutoTradeMasterToggle({
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
      const res = await setMasterAutoTrade(next);
      if (res.ok) {
        toast.success(
          next
            ? "Auto-trade ON — rules will execute as signals fire"
            : "Auto-trade OFF — all rules paused",
        );
      } else {
        setEnabled(!next); // revert
        toast.error(res.error);
      }
    });
  };

  return (
    <Card
      className={`p-6 flex items-center justify-between gap-4 ${
        enabled
          ? "border-emerald-400/30 bg-emerald-400/5"
          : "border-border/60 bg-card/40"
      }`}
    >
      <div className="flex items-start gap-4 flex-1">
        <div
          className={`h-10 w-10 rounded-md flex items-center justify-center shrink-0 border ${
            enabled
              ? "bg-emerald-400/15 border-emerald-400/30"
              : "bg-muted/40 border-border/60"
          }`}
        >
          {enabled ? (
            <Zap className="h-5 w-5 text-emerald-300" />
          ) : (
            <Power className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-medium">Auto-trade</h2>
            {enabled ? (
              <Badge className="bg-emerald-400/15 text-emerald-300 border border-emerald-400/30 text-[10px] py-0 h-5">
                ON
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-[10px] py-0 h-5 text-muted-foreground"
              >
                OFF
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {enabled
              ? `${activeCount} of ${totalCount} rules active. Signals that pass your rules + risk rails will submit bracket orders to Alpaca.`
              : "Master switch. Flip on to let rules execute automatically when signals fire. Individual rule modes still apply — this just unblocks them."}
          </p>
        </div>
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={handleToggle}
        disabled={isPending}
        className="scale-125"
      />
    </Card>
  );
}
