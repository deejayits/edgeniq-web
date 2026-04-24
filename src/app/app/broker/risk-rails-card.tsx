"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldAlert } from "lucide-react";
import { updateRiskRails, type RiskRailsUpdate } from "./actions";

export type RiskRailsRow = {
  chat_id: number;
  max_open_positions: number;
  max_alloc_per_ticker_pct: number;
  max_daily_loss_usd: number | null;
  max_daily_loss_pct: number | null;
  kill_switch_engaged?: boolean;
  kill_switch_engaged_at?: string | null;
  kill_switch_engaged_reason?: string | null;
};

export function RiskRailsCard({ rails }: { rails: RiskRailsRow }) {
  const [maxPositions, setMaxPositions] = useState(rails.max_open_positions);
  const [maxAllocPct, setMaxAllocPct] = useState(
    rails.max_alloc_per_ticker_pct,
  );
  const [maxDailyLossUsd, setMaxDailyLossUsd] = useState<string>(
    rails.max_daily_loss_usd != null ? String(rails.max_daily_loss_usd) : "",
  );
  const [maxDailyLossPct, setMaxDailyLossPct] = useState<string>(
    rails.max_daily_loss_pct != null ? String(rails.max_daily_loss_pct) : "",
  );
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    const upd: RiskRailsUpdate = {
      maxOpenPositions: maxPositions,
      maxAllocPerTickerPct: maxAllocPct,
      maxDailyLossUsd:
        maxDailyLossUsd.trim() === "" ? null : Number(maxDailyLossUsd),
      maxDailyLossPct:
        maxDailyLossPct.trim() === "" ? null : Number(maxDailyLossPct),
    };
    startTransition(async () => {
      const res = await updateRiskRails(upd);
      if (res.ok) {
        toast.success("Risk rails saved");
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Card className="p-6 border-amber-500/20 bg-amber-500/5 space-y-5">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-md bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
          <ShieldAlert className="h-4 w-4 text-amber-300" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium">Risk rails</h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Account-wide hard limits. Evaluated before per-signal rules —
            a tripped rail blocks every order regardless of execution mode.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Max open positions</Label>
          <Input
            type="number"
            min={1}
            max={100}
            step={1}
            value={maxPositions}
            onChange={(e) => setMaxPositions(Number(e.target.value))}
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Max allocation per ticker (%)</Label>
          <div className="relative">
            <Input
              type="number"
              min={1}
              max={100}
              step={1}
              value={maxAllocPct}
              onChange={(e) => setMaxAllocPct(Number(e.target.value))}
              className="h-9 pr-8"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              %
            </span>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Max daily loss ($) — optional</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              $
            </span>
            <Input
              type="number"
              min={0}
              step={50}
              placeholder="disabled"
              value={maxDailyLossUsd}
              onChange={(e) => setMaxDailyLossUsd(e.target.value)}
              className="h-9 pl-7"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Max daily loss (%) — optional</Label>
          <div className="relative">
            <Input
              type="number"
              min={0}
              step={0.5}
              placeholder="disabled"
              value={maxDailyLossPct}
              onChange={(e) => setMaxDailyLossPct(e.target.value)}
              className="h-9 pr-8"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              %
            </span>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Either (or both) daily-loss limits will halt auto-trading for the
        rest of the ET trading day once hit. Leave blank to disable that
        guardrail.
      </p>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending} size="sm">
          {isPending ? "Saving…" : "Save rails"}
        </Button>
      </div>
    </Card>
  );
}
