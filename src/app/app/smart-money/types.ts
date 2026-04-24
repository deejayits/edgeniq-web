// Shared types for the Smart Money surface. Kept in a neutral file
// so client + server components + server actions can all import
// without triggering a "use server" / "use client" boundary.

export type TargetType =
  | "politician"
  | "fund_13f"
  | "insider"
  | "activist";

export type SmartMoneyTarget = {
  id: string;
  target_type: TargetType;
  display_name: string;
  subtitle: string | null;
  external_id: string | null;
  reference_url: string | null;
  avatar_url: string | null;
  is_active: boolean;
  browse_priority: number;
};

export type SmartMoneyTrade = {
  id: string;
  target_id: string;
  symbol: string;
  side: "buy" | "sell" | "exchange" | "other";
  trade_date: string;
  filed_date: string | null;
  size_bucket: string | null;
  size_estimate_usd: number | null;
  price_estimate: number | null;
  source_url: string | null;
  notes: string | null;
};

export type SmartMoneyFollow = {
  id: string;
  chat_id: number;
  target_id: string;
  alert_on_trades: boolean;
  mimic_on_trades: boolean;
  min_size_usd: number;
  created_at: string;
};

export type TargetWithStats = SmartMoneyTarget & {
  trade_count_30d: number;
  last_trade_date: string | null;
  top_symbols: string[];
  is_followed: boolean;
  mimic_enabled: boolean;
};

// Human-readable labels + colors for target type badges.
export const TARGET_TYPE_LABEL: Record<TargetType, string> = {
  politician: "Politician",
  fund_13f: "Hedge Fund",
  insider: "Insider",
  activist: "Activist",
};

export const TARGET_TYPE_DESC: Record<TargetType, string> = {
  politician:
    "STOCK Act disclosures. 30-45 day filing latency — use as conviction, not fresh signal.",
  fund_13f:
    "Quarterly 13F filings. 45-day delay means positions are at least 6-8 weeks old.",
  insider:
    "Form 4 filings — corporate officers/directors. 2-day filing requirement; fast signal.",
  activist:
    "13D/13G filings when a fund takes a >5% stake. 10-day reporting window; headline catalyst.",
};
