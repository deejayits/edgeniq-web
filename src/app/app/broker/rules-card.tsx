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
  // Optional exit-strategy overrides. null = use the default for this
  // signal type (stocks → signal-defined bracket; options → risk
  // profile preset).
  target_pct: number | null;
  stop_pct: number | null;
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

// Per-option help text shown under the dropdown so users understand
// what each sizing strategy actually does. ATR-based is the least
// obvious — the value field becomes "$ risk per ATR" rather than a
// position size, which catches new users off guard.
const POSITION_SIZE_HELP: Record<RuleRow["position_size_type"], string> = {
  dollar_fixed:
    "Risk a fixed dollar amount per trade. Every order puts the same $ on the line — predictable, easy to reason about.",
  pct_buying_power:
    "Position scales with your account balance. 1% on $10k = $100; on $100k = $1,000. Compounds as the account grows.",
  share_fixed:
    "Always trade the same number of shares. Risk varies wildly with stock price — 100 shares of $5 vs $500 is very different.",
  atr_based:
    "Position size = $ risk ÷ ATR (the stock's average daily price range). Larger size on quiet stocks, smaller on volatile ones. Auto-adapts to volatility.",
};

const EXECUTION_MODE_HELP: Record<RuleRow["execution_mode"], string> = {
  off: "Bot ignores signals for this type — no buttons, no auto-submit.",
  one_tap:
    "Bot adds a Buy button to each matching alert. You tap to submit. Manual control with one-click execution.",
  auto: "Bot submits orders automatically when a signal passes your rules + rails. No taps needed.",
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
    draft.cooldown_minutes !== rule.cooldown_minutes ||
    draft.target_pct !== rule.target_pct ||
    draft.stop_pct !== rule.stop_pct;

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
        targetPct: draft.target_pct,
        stopPct: draft.stop_pct,
      };
      try {
        const res = await updateRules(payload);
        if (res.ok) {
          toast.success(`${title} rules saved`);
        } else {
          toast.error(res.error);
        }
      } catch (exc) {
        toast.error(
          exc instanceof Error ? exc.message : "Save failed — try again",
        );
      }
    });
  };

  // Default exit-strategy hints shown as placeholders. Stocks: signal-
  // defined bracket; options: risk-profile preset (30/30/40 stop and
  // 30/50/100 target depending on conservative/moderate/aggressive).
  const isOptions = draft.signal_type === "options";
  const targetPlaceholder = isOptions ? "50 (your profile)" : "from signal";
  const stopPlaceholder = isOptions ? "30 (your profile)" : "from signal";
  const exitHelp = isOptions
    ? "Override your risk profile's options target / stop. Leave blank to inherit (30/30/40 stop, 30/50/100 target on Conservative / Moderate / Aggressive)."
    : "Override the signal's bracket targets. Leave blank to use the signal-defined T2 + stop. Most users leave these untouched.";

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
          <p className="text-[11px] text-muted-foreground leading-snug">
            {EXECUTION_MODE_HELP[draft.execution_mode]}
          </p>
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
            <p className="text-[11px] text-muted-foreground leading-snug">
              Every signal carries a 0&ndash;100 conviction score (5
              factors blended). 65&ndash;70 is a balanced floor; 80+
              is highly selective. Higher = fewer trades, stronger
              setups.
            </p>
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
            <p className="text-[11px] text-muted-foreground leading-snug">
              Per-day cap on auto-submitted orders for this signal
              type. Once hit, further matching signals skip until
              tomorrow. Stops a signal-spam day from running away.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
          <div className="flex-1 pr-3">
            <Label className="text-sm">Watchlist only</Label>
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
              ON: auto-trade fires only for tickers you&rsquo;ve added
              to your /watchlist. OFF: any qualifying ticker the
              scanner finds — wider coverage, less curation.
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
          <p className="text-[11px] text-muted-foreground leading-snug">
            {POSITION_SIZE_HELP[draft.position_size_type]}
          </p>
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
          <p className="text-[11px] text-muted-foreground leading-snug">
            After a stop-out, pause auto-trade for THIS signal type for N
            minutes. Stops the bot from chasing back into the same setup
            after a fresh loss. 0 disables; 30&ndash;60 is a typical
            tilt-protection setting.
          </p>
        </div>
      </div>

      {/* Exit strategy override — optional. Leaving blank means the
          rule inherits the default for its signal type. */}
      <div className="space-y-2">
        <Label className="text-xs">Exit strategy (optional override)</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="relative">
            <Input
              type="number"
              min={0}
              max={500}
              step={1}
              placeholder={targetPlaceholder}
              value={draft.target_pct ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                setDraft({
                  ...draft,
                  target_pct: raw === "" ? null : Number(raw),
                });
              }}
              className="h-9 pr-12"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              % TP
            </span>
          </div>
          <div className="relative">
            <Input
              type="number"
              min={0}
              max={90}
              step={1}
              placeholder={stopPlaceholder}
              value={draft.stop_pct ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                setDraft({
                  ...draft,
                  stop_pct: raw === "" ? null : Number(raw),
                });
              }}
              className="h-9 pr-12"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              % SL
            </span>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug">
          {exitHelp}
        </p>
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
