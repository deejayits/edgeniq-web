// OPRA / OCC options symbol parser + human-readable formatter.
//
// OPRA is the industry-standard symbol format used by every US
// broker since 2010 (mandated by the Options Clearing Corp).
// Layout: <UNDERLYING><YYMMDD><C|P><STRIKE×1000 zero-padded to 8>
// Example: SPY260515C00714000 → SPY, exp 2026-05-15, Call, $714.00
//
// Stock tickers (NVDA, AAPL, etc.) are passed through unchanged so
// callers can pipe ANY symbol through formatSymbol() without first
// detecting whether it's an option.

export type OptionParts = {
  underlying: string;
  expiry: string; // ISO YYYY-MM-DD
  side: "call" | "put";
  strike: number;
};

const OPRA_RE = /^([A-Z]{1,6})(\d{6})([CP])(\d{8})$/;

export function isOpraSymbol(symbol: string): boolean {
  return OPRA_RE.test(symbol);
}

export function parseOpra(symbol: string): OptionParts | null {
  const m = OPRA_RE.exec(symbol);
  if (!m) return null;
  const [, root, yymmdd, cp, strikeRaw] = m;
  const yy = parseInt(yymmdd.slice(0, 2), 10);
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  // Two-digit-year window: 50-99 = 19xx, 00-49 = 20xx. OCC's
  // contracts only go out a few years so this rolls over cleanly
  // until 2050 — past that the spec gets a third digit.
  const fullYear = yy < 50 ? 2000 + yy : 1900 + yy;
  const strike = parseInt(strikeRaw, 10) / 1000;
  return {
    underlying: root,
    expiry: `${fullYear}-${mm}-${dd}`,
    side: cp === "C" ? "call" : "put",
    strike,
  };
}

/** Compact human form: "SPY 5/15/26 $714 C". Falls back to the
 *  raw symbol when it's not an OPRA option (e.g. plain stock ticker). */
export function formatSymbol(symbol: string): string {
  const parts = parseOpra(symbol);
  if (!parts) return symbol;
  const [yy, mm, dd] = parts.expiry.split("-");
  const yyShort = yy.slice(2);
  const sideShort = parts.side === "call" ? "C" : "P";
  // Trim trailing .00 on whole-dollar strikes so SPY $714.00 reads
  // as SPY $714 — most strikes ARE whole dollars and the .00 is
  // visual noise. Keep decimals when they exist (SPY $714.50).
  const strikeStr =
    parts.strike === Math.floor(parts.strike)
      ? `${parts.strike}`
      : parts.strike.toFixed(2);
  return `${parts.underlying} ${parseInt(mm, 10)}/${parseInt(dd, 10)}/${yyShort} $${strikeStr} ${sideShort}`;
}

/** Verbose human form: "SPY May 15 2026 $714 Call". Used for tooltips
 *  and detail views where space allows full month/year. */
export function formatSymbolLong(symbol: string): string {
  const parts = parseOpra(symbol);
  if (!parts) return symbol;
  const [yy, mm, dd] = parts.expiry.split("-");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const monthName = months[parseInt(mm, 10) - 1] ?? mm;
  const sideLabel = parts.side === "call" ? "Call" : "Put";
  const strikeStr =
    parts.strike === Math.floor(parts.strike)
      ? `${parts.strike}`
      : parts.strike.toFixed(2);
  return `${parts.underlying} ${monthName} ${parseInt(dd, 10)} ${yy} $${strikeStr} ${sideLabel}`;
}
