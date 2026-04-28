"use client";

import { useState } from "react";
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
  /** True iff this mode is the user's current routing target
      (matches users.active_broker_mode). When false, the toggle
      still saves state but visually communicates "configuration
      only — won't fire until you switch to this mode" so users
      don't read flipped-on as actively routing. Defaults to true
      to preserve the previous look for callers that pre-date this
      flag. */
  isActiveRoutingMode?: boolean;
  anyActive: boolean;
  activeCount: number;
  totalCount: number;
};

export function AutoTradeMasterToggle({
  mode,
  isActiveRoutingMode = true,
  anyActive,
  activeCount,
  totalCount,
}: Props) {
  const [enabled, setEnabled] = useState(anyActive);
  const [isPending, setIsPending] = useState(false);
  // When this tab is NOT the active routing mode, dim the visual
  // and surface a "config only" sub-label. Persisted state still
  // changes; bot still won't fire because routing target is
  // elsewhere.
  const isMuted = !isActiveRoutingMode;

  const handleToggle = async (next: boolean) => {
    // Optimistic: flip the visual immediately; revert on server error.
    setEnabled(next);
    setIsPending(true);
    try {
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
    } catch (exc) {
      setEnabled(!next); // revert on unexpected throw
      toast.error(
        exc instanceof Error ? exc.message : "Save failed — try again",
      );
    } finally {
      setIsPending(false);
    }
  };

  // Visual variants:
  //   active + enabled  → emerald (live, firing)
  //   active + disabled → neutral
  //   muted (inactive routing) → all amber regardless of enabled,
  //     because the on/off state only affects FUTURE behavior when
  //     the user switches to this mode.
  const cardClass = isMuted
    ? "border-amber-400/30 bg-amber-400/5"
    : enabled
      ? "border-emerald-400/30 bg-emerald-400/5"
      : "border-border/60 bg-card/40";
  const iconBg = isMuted
    ? "bg-amber-400/15 border-amber-400/30"
    : enabled
      ? "bg-emerald-400/15 border-emerald-400/30"
      : "bg-muted/40 border-border/60";
  const iconColor = isMuted
    ? "text-amber-300"
    : enabled
      ? "text-emerald-300"
      : "text-muted-foreground";
  const stateLabel = isMuted
    ? "Saved · not routing"
    : enabled
      ? "Enabled"
      : "Disabled";
  const stateColor = isMuted
    ? "text-amber-300"
    : enabled
      ? "text-emerald-300"
      : "text-muted-foreground";
  const otherMode = mode === "live" ? "Paper" : "Live";

  return (
    <Card className={`p-6 flex flex-col h-full space-y-4 ${cardClass}`}>
      <div className="flex items-start gap-3">
        <div
          className={`h-10 w-10 rounded-md flex items-center justify-center shrink-0 border ${iconBg}`}
        >
          {enabled && !isMuted ? (
            <Zap className={`h-4 w-4 ${iconColor}`} />
          ) : (
            <Power className={`h-4 w-4 ${iconColor}`} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium">Auto-trade</h3>
            {isMuted ? (
              <Badge
                variant="outline"
                className="border-amber-400/40 bg-amber-400/10 text-amber-200 text-[10px] py-0 h-5"
              >
                Configuration only
              </Badge>
            ) : enabled ? (
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
            {isMuted
              ? `${otherMode} is the active routing mode. These rules are saved but won't fire until you switch to ${mode === "live" ? "Live" : "Paper"}.`
              : enabled
                ? "Orders submit to Alpaca when signals pass your rules + rails."
                : "Flip on to let rules execute automatically when signals fire."}
          </p>
        </div>
      </div>
      <div className="mt-auto pt-2 border-t border-border/40 flex items-center justify-between">
        <span
          className={`text-xs font-semibold uppercase tracking-wider ${stateColor}`}
        >
          {stateLabel}
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
