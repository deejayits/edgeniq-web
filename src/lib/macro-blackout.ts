// Macro blackout window math. Mirrored from the bot's
// scanner/macro_blackouts.py — keep these constants in sync if
// either side changes.
//
// Source of truth: data flows bot → Supabase macro_events table.
// Web reads + computes the window client-side here so the banner
// renders without an extra round-trip to the bot.

export type MacroEventRow = {
  event_date: string; // YYYY-MM-DD
  time_et: string; // HH:MM 24h
  kind: string;
  weight: string;
  title: string | null;
};

const WINDOWS_MINUTES: Record<string, [number, number]> = {
  high: [30, 60],
  medium: [15, 30],
  low: [0, 0],
};

const KIND_LABEL: Record<string, string> = {
  fomc: "FOMC rate decision",
  cpi: "CPI release",
  jobs: "Nonfarm Payrolls",
  gdp: "GDP release",
  fed_speech: "Fed Chair speech",
  ppi: "PPI release",
  retail_sales: "Retail Sales",
};

export type MacroState =
  | { phase: "blocked"; event: MacroEventRow; pre: number; post: number; reason: string }
  | { phase: "approaching"; event: MacroEventRow; minutesUntil: number }
  | { phase: "clear" };

function eventToUtc(row: MacroEventRow): Date | null {
  // event_date + time_et are wall-clock ET. We construct an ET-zoned
  // Date by relying on the IANA "America/New_York" offset for that
  // wall-clock — the browser's Intl machinery handles DST.
  const [y, m, d] = row.event_date.split("-").map(Number);
  const [hh, mm] = row.time_et.split(":").map(Number);
  if ([y, m, d, hh, mm].some((n) => Number.isNaN(n))) return null;
  // Build a "would-be UTC" timestamp from those wall-clock values, then
  // adjust by the ET offset for that moment. Cheaper than pulling a
  // dedicated tz library; correct around DST because we ask the runtime
  // for the offset of *that specific timestamp*.
  const naiveUtc = Date.UTC(y, m - 1, d, hh, mm);
  const et = new Date(naiveUtc).toLocaleString("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  // Parse back the toLocaleString output to figure the offset.
  const match = et.match(
    /(\d{2})\/(\d{2})\/(\d{4}),?\s+(\d{2}):(\d{2}):(\d{2})/,
  );
  if (!match) return new Date(naiveUtc);
  const [, etM, etD, etY, etH, etMin, etS] = match;
  const wallAsUtc = Date.UTC(
    Number(etY),
    Number(etM) - 1,
    Number(etD),
    Number(etH),
    Number(etMin),
    Number(etS),
  );
  // Offset = how far ET wall-clock is behind UTC for this moment.
  const offsetMs = naiveUtc - wallAsUtc;
  return new Date(naiveUtc + offsetMs);
}

export function computeMacroState(
  rows: ReadonlyArray<MacroEventRow>,
  now: Date = new Date(),
): MacroState {
  let bestApproaching: { event: MacroEventRow; minutesUntil: number } | null =
    null;
  for (const row of rows) {
    if (!WINDOWS_MINUTES[row.weight]) continue;
    const [pre, post] = WINDOWS_MINUTES[row.weight];
    const ev = eventToUtc(row);
    if (!ev) continue;
    const start = new Date(ev.getTime() - pre * 60_000);
    const end = new Date(ev.getTime() + post * 60_000);
    if (now >= start && now <= end) {
      const label =
        row.title || KIND_LABEL[row.kind] || row.kind.toUpperCase();
      return {
        phase: "blocked",
        event: row,
        pre,
        post,
        reason: `${label} at ${row.time_et} ET — auto-trade paused ${pre} min before / ${post} min after`,
      };
    }
    // Approaching window — within 90 min of the event but not yet
    // blackout. Surfaces a softer "FOMC at 2 PM ET — heads up" line.
    if (ev > now) {
      const minutesUntil = Math.round((ev.getTime() - now.getTime()) / 60_000);
      if (minutesUntil <= 90) {
        if (
          bestApproaching === null
          || minutesUntil < bestApproaching.minutesUntil
        ) {
          bestApproaching = { event: row, minutesUntil };
        }
      }
    }
  }
  if (bestApproaching) {
    return { phase: "approaching", ...bestApproaching };
  }
  return { phase: "clear" };
}

export function macroEventLabel(row: MacroEventRow): string {
  return row.title || KIND_LABEL[row.kind] || row.kind.toUpperCase();
}
