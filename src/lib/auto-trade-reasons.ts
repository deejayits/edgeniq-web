// Plain-English mapping for auto_trades.error_message + status.
//
// Source rejects come from two paths:
//   1. Local gate denials in scanner/broker/auto_trader (kill switch,
//      risk rails, score, watchlist) — usually a short imperative line.
//   2. Alpaca API errors when we DO submit — full vendor JSON with
//      codes like 403100 (insufficient buying power).
//
// We map the most common patterns to a short label + an actionable hint.
// Anything unmapped passes through as the raw error_message so the
// reason column never shows a blank cell.

export type AutoTradeReason = {
  label: string;
  hint?: string;
  // Whether this reject is something the USER can act on (add funds,
  // enable options, release kill switch). Used by the bot side to
  // decide whether to DM. Web shows everything.
  actionable: boolean;
};

const REASON_PATTERNS: ReadonlyArray<{
  match: RegExp;
  reason: AutoTradeReason;
}> = [
  // --- Account / funds ------------------------------------------------
  {
    // Alpaca's "buying power" rejection codes:
    //   40310000 — 403 with cost_basis: not enough BP for this order
    //   403100   — older 4-digit form (kept for safety)
    //   plus any plain "insufficient" / "buying.power" wording.
    // The cost_basis field also signals the same condition when the
    // truncated message hides the explicit code.
    match: /insufficient (buying power|funds)|buying.power|40310000|403100|cost_basis/i,
    reason: {
      label: "Insufficient buying power",
      hint: "Add funds in Alpaca or shrink position size",
      actionable: true,
    },
  },
  {
    match: /options trading.*not (approved|enabled)|options.*not enabled|level \d.*options/i,
    reason: {
      label: "Options not enabled on Alpaca",
      hint: "Enable options trading in your Alpaca account settings",
      actionable: true,
    },
  },
  {
    // Alpaca code 42210000 = "asset is not tradable" (and the
    // 5xx-truncated form of that message often ends mid-symbol so we
    // can't rely on the literal "not tradable" suffix being present).
    match: /asset .* not tradable|not.tradable|symbol.*not found|invalid symbol|42210000|"asset/i,
    reason: {
      label: "Symbol not tradable on Alpaca",
      hint: "Some far-OTM / weekly options aren't enabled on every Alpaca account",
      actionable: false,
    },
  },
  {
    match: /market is closed|market closed|market.*not open/i,
    reason: {
      label: "Market closed",
      hint: "Day orders only fill during regular hours",
      actionable: false,
    },
  },

  // --- Local risk rails (auto_trader local rejects) -------------------
  {
    match: /kill.switch|kill_switch/i,
    reason: {
      label: "Kill switch engaged",
      hint: "Release on /app/broker once you're ready to resume",
      actionable: true,
    },
  },
  {
    match: /max_open_positions/i,
    reason: {
      label: "Max open positions reached",
      hint: "Close a position or raise the cap on /app/broker",
      actionable: true,
    },
  },
  {
    match: /max_alloc_per_ticker|alloc.*per.ticker/i,
    reason: {
      label: "Per-ticker allocation cap hit",
      hint: "Already at max exposure for this underlying",
      actionable: false,
    },
  },
  {
    match: /max_daily_loss|daily.loss.cap/i,
    reason: {
      label: "Daily loss cap hit",
      hint: "Trading paused for today; resets midnight ET",
      actionable: true,
    },
  },
  {
    match: /watchlist.only|not in watchlist/i,
    reason: {
      label: "Not on your watchlist",
      hint: "Rule says watchlist-only — add the ticker or relax the rule",
      actionable: false,
    },
  },
  {
    match: /min.score|score below|score \d+ <|below threshold/i,
    reason: {
      label: "Below your min-score threshold",
      actionable: false,
    },
  },
  {
    match: /computed qty.*<= 0|qty.*0|position size too small/i,
    reason: {
      label: "Position size too small",
      hint: "Raise sizing or lower min-price; computed quantity was zero",
      actionable: true,
    },
  },
  {
    match: /cooldown|tilt.protection|stop.out.cooldown/i,
    reason: {
      label: "Cooldown after stop-out",
      hint: "Auto-trade paused for this signal type briefly",
      actionable: false,
    },
  },

  // --- Alpaca-side rate limits / soft errors --------------------------
  {
    match: /rate.limit|429/i,
    reason: {
      label: "Alpaca rate limit",
      actionable: false,
    },
  },
  {
    match: /pdt|pattern.day.trader/i,
    reason: {
      label: "PDT rule blocked the order",
      hint: "Pattern Day Trader rule on Alpaca — wait or add equity",
      actionable: true,
    },
  },
];

export function humanizeRejectReason(
  status: string | null | undefined,
  errorMessage: string | null | undefined,
): AutoTradeReason | null {
  // Filled / accepted / pending — no reason to show.
  if (!status) return null;
  const s = status.toLowerCase();
  if (s === "filled" || s === "partial" || s === "accepted" || s === "submitted") {
    return null;
  }
  if (!errorMessage) {
    // Status was rejected/canceled/expired but no message stored.
    // Best-effort fallback so the column never reads "—" on a reject.
    if (s === "canceled") return { label: "Canceled", actionable: false };
    if (s === "expired") return { label: "Expired", actionable: false };
    return { label: "Rejected (no detail captured)", actionable: false };
  }
  for (const { match, reason } of REASON_PATTERNS) {
    if (match.test(errorMessage)) return reason;
  }
  // Unmapped: return the first sentence of the raw message, capped.
  const first = errorMessage.split(/[.\n]/)[0]?.trim() || errorMessage;
  return {
    label: first.slice(0, 80),
    actionable: false,
  };
}

// Bucket the trades for the summary banner. Returns `total / filled /
// rejected` plus a top-3 reject reason breakdown for actionable copy.
export function summarizeAutoTrades(
  trades: ReadonlyArray<{
    status: string | null;
    error_message: string | null;
  }>,
): {
  total: number;
  filled: number;
  rejected: number;
  pending: number;
  topRejectReasons: ReadonlyArray<{ label: string; count: number }>;
} {
  let filled = 0;
  let rejected = 0;
  let pending = 0;
  const reasonCounts = new Map<string, number>();
  for (const t of trades) {
    const s = (t.status || "").toLowerCase();
    if (s === "filled" || s === "partial") {
      filled++;
    } else if (s === "rejected" || s === "canceled" || s === "expired") {
      rejected++;
      const r = humanizeRejectReason(t.status, t.error_message);
      if (r) reasonCounts.set(r.label, (reasonCounts.get(r.label) ?? 0) + 1);
    } else {
      pending++;
    }
  }
  const topRejectReasons = [...reasonCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  return {
    total: trades.length,
    filled,
    rejected,
    pending,
    topRejectReasons,
  };
}
