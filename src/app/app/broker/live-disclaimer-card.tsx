"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { acceptLiveDisclaimer } from "./live-actions";

// Six specific risk acknowledgements — each must be checked. We
// deliberately list the SPECIFIC risks (not vague "trading is risky")
// so a user can never claim they didn't know what they were agreeing
// to. Each one maps to a concrete failure mode we've seen in retail
// auto-trading complaints.
const RISKS = [
  {
    id: "loss",
    label:
      "I can lose 100% of any capital deployed via live auto-trading. Losses are real and unrecoverable.",
  },
  {
    id: "slippage",
    label:
      "Market orders can fill at prices materially worse than the signal's quoted price during volatile conditions or thin liquidity.",
  },
  {
    id: "stops",
    label:
      "Stop-loss orders are not guaranteed. Gaps, halts, and after-hours price moves can fill stops far from the stop price.",
  },
  {
    id: "advice",
    label:
      "EdgeNiq does not provide investment advice. Signals are statistical setups, not recommendations. I make my own decisions.",
  },
  {
    id: "bugs",
    label:
      "Software has bugs. EdgeNiq has bugs. I accept that an edge case may produce an unintended order, and that I check my Alpaca account regularly.",
  },
  {
    id: "responsibility",
    label:
      "I am the sole party responsible for every order placed through my Alpaca account, regardless of its origin. EdgeNiq's role is order routing, not fiduciary.",
  },
] as const;

export function LiveDisclaimerCard() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const allChecked = RISKS.every((r) => checked[r.id]);

  function handleAccept() {
    if (!allChecked) {
      setError("Check every risk acknowledgement before continuing.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await acceptLiveDisclaimer();
      if (!res.ok) setError(res.error);
      // On success, the server action revalidates and the page
      // re-renders into the next state (NEEDS_CONNECTION). No
      // client-side state to clear.
    });
  }

  return (
    <Card className="p-6 border-rose-500/40 bg-rose-500/5">
      <div className="flex items-start gap-3 mb-5">
        <AlertTriangle className="h-5 w-5 text-rose-300 shrink-0 mt-0.5" />
        <div>
          <h2 className="text-lg font-semibold">Before live trading</h2>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            Live mode routes orders to your real Alpaca account. Read
            each line below and check it to acknowledge. All six are
            required.
          </p>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        {RISKS.map((risk) => (
          <label
            key={risk.id}
            className="flex items-start gap-3 cursor-pointer group"
          >
            <input
              type="checkbox"
              checked={!!checked[risk.id]}
              onChange={(e) => {
                setChecked((c) => ({ ...c, [risk.id]: e.target.checked }));
                if (error) setError(null);
              }}
              disabled={pending}
              className="mt-1 h-4 w-4 accent-rose-400 cursor-pointer"
            />
            <span className="text-sm text-foreground leading-relaxed group-hover:text-foreground/90">
              {risk.label}
            </span>
          </label>
        ))}
      </div>

      {error && (
        <div className="text-xs text-rose-300 mb-3">{error}</div>
      )}

      <Button
        type="button"
        onClick={handleAccept}
        disabled={!allChecked || pending}
        className="w-full bg-rose-500/15 text-rose-200 border border-rose-500/40 hover:bg-rose-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
        variant="outline"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : null}
        I accept these risks and want to continue
      </Button>
      <p className="text-[11px] text-muted-foreground mt-3 text-center">
        Accepting logs your acknowledgement (timestamped, version
        {" "}1) to your account record. You can disable live trading
        any time without re-accepting.
      </p>
    </Card>
  );
}
