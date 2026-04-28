"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Moon } from "lucide-react";
import { updateFlattenEod, type FlattenEodUpdate } from "./actions";

export type EodFlattenRow = {
  enabled: boolean;
  minLossPct: number;
};

// EOD flatten control card. Mirrors the broker page's per-tab card
// pattern (RulesCard / RiskRailsCard) — local draft state, save-on-
// click, optimistic toast + bot DM mirror via the action.
export function EodFlattenCard({ initial }: { initial: EodFlattenRow }) {
  const [enabled, setEnabled] = useState<boolean>(initial.enabled);
  const [minLoss, setMinLoss] = useState<string>(
    initial.minLossPct > 0 ? String(initial.minLossPct) : "",
  );
  const [isPending, setIsPending] = useState(false);

  const dirty =
    enabled !== initial.enabled
    || (minLoss.trim() === ""
        ? initial.minLossPct !== 0
        : Number(minLoss) !== initial.minLossPct);

  const handleSave = async () => {
    const upd: FlattenEodUpdate = {
      enabled,
      minLossPct:
        minLoss.trim() === "" ? null : Number(minLoss),
    };
    setIsPending(true);
    try {
      const res = await updateFlattenEod(upd);
      if (res.ok) {
        toast.success("EOD flatten preferences saved");
      } else {
        toast.error(res.error);
      }
    } catch (exc) {
      toast.error(
        exc instanceof Error ? exc.message : "Save failed — try again",
      );
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Card className="p-6 border-violet-500/20 bg-violet-500/5 space-y-5">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-md bg-violet-500/15 border border-violet-500/30 flex items-center justify-center shrink-0">
          <Moon className="h-4 w-4 text-violet-300" />
        </div>
        <div className="space-y-1 flex-1 min-w-0">
          <h3 className="text-base font-semibold tracking-tight">
            End-of-day flatten
          </h3>
          <p className="text-xs text-muted-foreground leading-snug">
            ~15 min before market close, the bot can market-close
            every open auto-trade position to avoid overnight gap
            risk and theta decay on short-dated options. You always
            get a 30-min heads-up DM listing what's about to close.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md border border-border/60 bg-card/40 p-3">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium">
            Flatten positions before close
          </Label>
          <p className="text-[11px] text-muted-foreground">
            ON: close all open positions ~15 min before market close.
            OFF: hold overnight, only live stops can close.
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={setEnabled}
          disabled={isPending}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Loss threshold (optional)
        </Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={100}
            step={1}
            value={minLoss}
            onChange={(e) => setMinLoss(e.target.value)}
            placeholder="0 = flatten all"
            disabled={!enabled || isPending}
            className="w-32 font-mono"
          />
          <span className="text-sm text-muted-foreground">% loss</span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug">
          When set, only positions losing MORE than this percentage
          will be flattened. Winners + smaller losers hold overnight.
          Leave blank or 0 to flatten regardless of P&L.
        </p>
      </div>

      <div className="flex justify-end pt-1">
        <Button
          onClick={handleSave}
          disabled={!dirty || isPending}
          variant={dirty ? "default" : "secondary"}
          size="sm"
        >
          {isPending ? "Saving…" : dirty ? "Save changes" : "No changes"}
        </Button>
      </div>
    </Card>
  );
}
