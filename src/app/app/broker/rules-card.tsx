"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { updateRules, type RulesUpdate } from "./actions";

export type RuleRow = {
  chat_id: number;
  signal_type: "stocks" | "options";
  mode: "paper" | "live";
  execution_mode: "off" | "one_tap" | "auto";
  min_score: number;
  watchlist_only: boolean;
  position_size_type:
    | "dollar_fixed"
    | "pct_buying_power"
    | "share_fixed"
    | "atr_based";
  position_size_value: number;
  max_daily_orders: number;
  cooldown_minutes: number;
};

const POSITION_SIZE_LABEL: Record<RuleRow["position_size_type"], string> = {
  dollar_fixed: "Fixed $",
  pct_buying_power: "% of buying power",
  share_fixed: "Fixed shares",
  atr_based: "ATR-based",
};

const POSITION_SIZE_UNIT: Record<RuleRow["position_size_type"], string> = {
  dollar_fixed: "$",
  pct_buying_power: "%",
  share_fixed: "shares",
  atr_based: "$ risk",
};

export function RulesCard({ rule, title, description }: {
  rule: RuleRow;
  title: string;
  description: string;
}) {
  // Local draft state — we only write on Save to keep round-trips low.
  const [draft, setDraft] = useState<RuleRow>(rule);
  const [isPending, startTransition] = useTransition();

  const dirty =
    draft.execution_mode !== rule.execution_mode ||
    draft.min_score !== rule.min_score ||
    draft.watchlist_only !== rule.watchlist_only ||
    draft.position_size_type !== rule.position_size_type ||
    draft.position_size_value !== rule.position_size_value ||
    draft.max_daily_orders !== rule.max_daily_orders ||
    draft.cooldown_minutes !== rule.cooldown_minutes;

  const handleSave = () => {
    startTransition(async () => {
      const payload: RulesUpdate = {
        signalType: draft.signal_type,
        mode: draft.mode,
        executionMode: draft.execution_mode,
        minScore: draft.min_score,
        watchlistOnly: draft.watchlist_only,
        positionSizeType: draft.position_size_type,
        positionSizeValue: draft.position_size_value,
        maxDailyOrders: draft.max_daily_orders,
        cooldownMinutes: draft.cooldown_minutes,
      };
      const res = await updateRules(payload);
      if (res.ok) {
        toast.success(`${title} rules saved`);
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Card className="p-6 border-border/60 bg-card/40 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{title}</h3>
            {draft.execution_mode === "auto" && (
              <Badge className="bg-emerald-400/15 text-emerald-300 border border-emerald-400/30 text-[10px] py-0 h-5">
                auto
              </Badge>
            )}
            {draft.execution_mode === "one_tap" && (
              <Badge className="bg-primary/15 text-primary border border-primary/30 text-[10px] py-0 h-5">
                one-tap
              </Badge>
            )}
            {draft.execution_mode === "off" && (
              <Badge variant="outline" className="text-[10px] py-0 h-5">
                off
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Execution mode */}
        <div className="space-y-1.5">
          <Label className="text-xs">Execution mode</Label>
          <Select
            value={draft.execution_mode}
            onValueChange={(v) =>
              setDraft({ ...draft, execution_mode: v as RuleRow["execution_mode"] })
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="off">
                Off — never auto-submit
              </SelectItem>
              <SelectItem value="one_tap">
                One-tap — show Buy button on alerts
              </SelectItem>
              <SelectItem value="auto">
                Auto — submit automatically
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Pre-trade filters */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Min signal score</Label>
            <Input
              type="number"
              min={50}
              max={100}
              step={1}
              value={draft.min_score}
              onChange={(e) =>
                setDraft({ ...draft, min_score: Number(e.target.value) })
              }
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Max daily orders</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step={1}
              value={draft.max_daily_orders}
              onChange={(e) =>
                setDraft({ ...draft, max_daily_orders: Number(e.target.value) })
              }
              className="h-9"
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
          <div>
            <Label className="text-sm">Watchlist only</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Only execute for tickers on your watchlist
            </p>
          </div>
          <Switch
            checked={draft.watchlist_only}
            onCheckedChange={(v) =>
              setDraft({ ...draft, watchlist_only: v })
            }
          />
        </div>

        {/* Position sizing */}
        <div className="space-y-1.5">
          <Label className="text-xs">Position sizing</Label>
          <div className="grid grid-cols-2 gap-3">
            <Select
              value={draft.position_size_type}
              onValueChange={(v) =>
                setDraft({
                  ...draft,
                  position_size_type: v as RuleRow["position_size_type"],
                })
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(POSITION_SIZE_LABEL) as Array<
                  RuleRow["position_size_type"]
                >).map((k) => (
                  <SelectItem key={k} value={k}>
                    {POSITION_SIZE_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative">
              <Input
                type="number"
                min={0}
                step={draft.position_size_type === "pct_buying_power" ? 0.5 : 1}
                value={draft.position_size_value}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    position_size_value: Number(e.target.value),
                  })
                }
                className="h-9 pr-14"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {POSITION_SIZE_UNIT[draft.position_size_type]}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Cooldown after loss (minutes)</Label>
          <Input
            type="number"
            min={0}
            step={15}
            value={draft.cooldown_minutes}
            onChange={(e) =>
              setDraft({ ...draft, cooldown_minutes: Number(e.target.value) })
            }
            className="h-9"
          />
          <p className="text-[11px] text-muted-foreground">
            0 = no cooldown. Pauses auto-trade for this signal type after a
            stop-out.
          </p>
        </div>
      </div>

      <div className="pt-2 flex justify-end">
        <Button
          onClick={handleSave}
          disabled={!dirty || isPending}
          size="sm"
        >
          {isPending ? "Saving…" : dirty ? "Save changes" : "No changes"}
        </Button>
      </div>
    </Card>
  );
}
