"use client";

// Inline editors for the settings page. Each editor:
//   - Renders the current value.
//   - On change, calls the matching server action with optimistic UI.
//   - Shows a tiny inline error when the server rejects (rare — both
//     web validation + DB check constraint usually catch invalid
//     input before this fires).
//
// We deliberately avoid wiring any toast library or shadcn Dialog
// here — every editor is a single dropdown / button / input that
// either succeeds silently or shows the error inline. Smaller surface
// = fewer cross-component coordination bugs.

import { useEffect, useState, useTransition } from "react";
import { ChevronDown, Check, Plus, X, Loader2 } from "lucide-react";
import { ConvictionBadge } from "@/components/conviction-badge";
import {
  updateRiskProfile,
  updateStrategy,
  updateMinPrice,
  addWatchlistTicker,
  removeWatchlistTicker,
} from "./actions";

const RISK_OPTIONS: {
  value: string;
  label: string;
  tone: string;
  help: string;
}[] = [
  {
    value: "conservative",
    label: "Conservative",
    tone: "text-emerald-300",
    help: "Smallest sizing, most selective — only the highest-conviction signals reach you.",
  },
  {
    value: "moderate",
    label: "Moderate",
    tone: "text-primary",
    help: "Balanced sizing across most setups. Default — fits most users.",
  },
  {
    value: "aggressive",
    label: "Aggressive",
    tone: "text-amber-300",
    help: "Larger sizing, more signals including lower-confidence setups. More opportunities, more drawdown risk.",
  },
];

const STRATEGY_OPTIONS: { value: string; label: string; help: string }[] = [
  {
    value: "balanced",
    label: "⚖️  Balanced",
    help: "All setup types — no filter. Recommended unless you have a specific edge.",
  },
  {
    value: "momentum_breakouts",
    label: "🚀  Momentum Breakouts",
    help: "Only price-volume breakouts above resistance. Works best in trending markets.",
  },
  {
    value: "mean_reversion",
    label: "🔄  Mean Reversion",
    help: "Only oversold pullbacks expected to bounce. Works best in range-bound markets.",
  },
  {
    value: "trend_following",
    label: "📈  Trend Following",
    help: "Only signals aligned with the prevailing daily trend. Filters out chop and reversals.",
  },
  {
    value: "post_earnings_drift",
    label: "📢  Post-Earnings Drift",
    help: "Only post-earnings continuation moves. Fewer signals, narrower window.",
  },
  {
    value: "high_conviction",
    label: "🎯  High Conviction Only",
    help: "Strictest filter across all setup types — only top-tier conviction scores. Fewer signals, higher quality.",
  },
];

const PRICE_TIERS: { value: number; label: string; sub: string; help: string }[] = [
  {
    value: 0,
    label: "$0",
    sub: "anything goes",
    help: "No floor — sub-dollar penny stocks included. Highest scam / liquidity risk.",
  },
  {
    value: 1,
    label: "$1",
    sub: "low-priced US-listed allowed",
    help: "Excludes sub-$1 stocks but still allows low-priced US-listed names.",
  },
  {
    value: 5,
    label: "$5",
    sub: "SEC penny-stock floor (default)",
    help: "Mirrors the SEC's penny-stock threshold. Recommended — filters out the riskiest tier.",
  },
];

function ErrorLine({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <span className="text-xs text-rose-300 ml-2 align-middle">{msg}</span>
  );
}

// Auto-dismiss inline error after a few seconds. Without this, a
// rejected attempt (bad ticker, server validation) leaves a stale
// red message hanging next to the form forever — looks like the
// problem persists even after the user has moved on. 5s is long
// enough to read, short enough to feel transient.
function useAutoClearError(
  error: string | null,
  setError: (e: string | null) => void,
  delayMs = 5000,
) {
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), delayMs);
    return () => clearTimeout(t);
  }, [error, setError, delayMs]);
}

export function RiskProfileEditor({ value }: { value: string }) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<string>(value);
  const [error, setError] = useState<string | null>(null);
  useAutoClearError(error, setError);
  const current = RISK_OPTIONS.find((o) => o.value === optimistic) ?? RISK_OPTIONS[1];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <select
            value={optimistic}
            disabled={pending}
            onChange={(e) => {
              const next = e.target.value;
              const prev = optimistic;
              setOptimistic(next);
              setError(null);
              startTransition(async () => {
                const res = await updateRiskProfile(next);
                if (!res.ok) {
                  setOptimistic(prev);
                  setError(res.error);
                }
              });
            }}
            className={`appearance-none w-full pl-3 pr-7 py-1.5 rounded-md bg-card border border-border/60 text-sm font-medium ${current.tone} hover:border-border focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer disabled:opacity-50`}
          >
            {RISK_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="text-foreground">
                {o.label}
              </option>
            ))}
          </select>
          {pending ? (
            <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground pointer-events-none" />
          ) : (
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          )}
        </div>
      </div>
      <ErrorLine msg={error} />
      <p className="text-[11px] text-muted-foreground leading-snug">
        {current.help}
      </p>
    </div>
  );
}

export function StrategyEditor({ value }: { value: string }) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<string>(value);
  const [error, setError] = useState<string | null>(null);
  useAutoClearError(error, setError);
  const current =
    STRATEGY_OPTIONS.find((o) => o.value === optimistic) ?? STRATEGY_OPTIONS[0];

  return (
    <div className="space-y-2">
      <div className="relative">
        <select
          value={optimistic}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.value;
            const prev = optimistic;
            setOptimistic(next);
            setError(null);
            startTransition(async () => {
              const res = await updateStrategy(next);
              if (!res.ok) {
                setOptimistic(prev);
                setError(res.error);
              }
            });
          }}
          className="appearance-none w-full pl-3 pr-7 py-1.5 rounded-md bg-card border border-border/60 text-sm font-medium hover:border-border focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer disabled:opacity-50"
        >
          {STRATEGY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} className="text-foreground">
              {o.label}
            </option>
          ))}
        </select>
        {pending ? (
          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground pointer-events-none" />
        ) : (
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        )}
      </div>
      <ErrorLine msg={error} />
      <p className="text-[11px] text-muted-foreground leading-snug">
        {current.help}
      </p>
    </div>
  );
}

export function MinPriceEditor({ value }: { value: number }) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<number>(value);
  const [error, setError] = useState<string | null>(null);
  useAutoClearError(error, setError);
  const current =
    PRICE_TIERS.find((t) => t.value === optimistic) ?? PRICE_TIERS[2];

  return (
    <div className="space-y-2">
      <div className="inline-flex w-full rounded-md border border-border/60 bg-card overflow-hidden">
        {PRICE_TIERS.map((t) => {
          const active = optimistic === t.value;
          return (
            <button
              key={t.value}
              type="button"
              disabled={pending}
              onClick={() => {
                if (active) return;
                const prev = optimistic;
                setOptimistic(t.value);
                setError(null);
                startTransition(async () => {
                  const res = await updateMinPrice(t.value);
                  if (!res.ok) {
                    setOptimistic(prev);
                    setError(res.error);
                  }
                });
              }}
              title={t.sub}
              className={`flex-1 px-3 py-1.5 text-sm font-mono border-r border-border/40 last:border-0 transition disabled:opacity-50 ${
                active
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
              }`}
            >
              {t.label}
              {active && pending && (
                <Loader2 className="inline h-3 w-3 ml-1 animate-spin" />
              )}
            </button>
          );
        })}
      </div>
      <ErrorLine msg={error} />
      <p className="text-[11px] text-muted-foreground leading-snug">
        {current.help}
      </p>
    </div>
  );
}

// Watchlist editor: chips with × on hover + "add ticker" input. Each
// chip shows the ConvictionBadge so the conviction signal stays
// visible even while editing.
export function WatchlistEditor({
  initial,
  scoreByTicker,
}: {
  initial: string[];
  scoreByTicker: Record<string, number>;
}) {
  const [pending, startTransition] = useTransition();
  const [tickers, setTickers] = useState<string[]>(initial);
  const [draft, setDraft] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  useAutoClearError(error, setError);

  function add() {
    const t = draft.trim().toUpperCase();
    if (!t) return;
    if (tickers.includes(t)) {
      setDraft("");
      return;
    }
    const prev = tickers;
    setTickers([...prev, t]);
    setDraft("");
    setError(null);
    startTransition(async () => {
      const res = await addWatchlistTicker(t);
      if (!res.ok) {
        setTickers(prev);
        setError(res.error);
      }
    });
  }

  function remove(t: string) {
    const prev = tickers;
    setTickers(prev.filter((x) => x !== t));
    setError(null);
    startTransition(async () => {
      const res = await removeWatchlistTicker(t);
      if (!res.ok) {
        setTickers(prev);
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-2">
      {/* Chips and the add-ticker input share one flex-wrap so the
          input naturally tucks into the empty space at the end of the
          last chip row. Previously the input was on its own row below
          the chips, leaving a wide right-side gap when the chip count
          didn't fill the line. */}
      <div className="flex flex-wrap items-center gap-2">
        {tickers.map((t) => (
          <WatchlistChip
            key={t}
            ticker={t}
            score={scoreByTicker[t.toUpperCase()] ?? null}
            onRemove={() => remove(t)}
            disabled={pending}
          />
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          className="inline-flex items-center gap-1.5"
        >
          <input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value.toUpperCase());
              if (error) setError(null);
            }}
            placeholder={
              tickers.length === 0 ? "Add your first ticker (e.g. NVDA)" : "Add ticker"
            }
            maxLength={10}
            className="bg-card border border-border/60 rounded-md px-3 py-1.5 text-sm font-mono w-44 placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <button
            type="submit"
            disabled={pending || !draft.trim()}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 disabled:opacity-40 disabled:cursor-not-allowed transition"
            aria-label="Add ticker"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
          </button>
        </form>
      </div>
      <ErrorLine msg={error} />
    </div>
  );
}

function WatchlistChip({
  ticker,
  score,
  onRemove,
  disabled,
}: {
  ticker: string;
  score: number | null;
  onRemove: () => void;
  disabled: boolean;
}) {
  return (
    <span className="group relative inline-flex items-center">
      <ConvictionBadge ticker={ticker} score={score} />
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        title={`Remove ${ticker}`}
        className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-card border border-border text-muted-foreground hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-400/40 opacity-0 group-hover:opacity-100 disabled:opacity-30 transition flex items-center justify-center"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}
