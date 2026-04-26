// Single-source conviction badge so the watchlist (settings), the
// dashboard "top conviction" tile, and any future surface (ticker
// detail, signal cards) all render the score the same way.
//
// Score → color mapping mirrors the four labels emitted by the bot:
//   85+   very strong  → emerald
//   70-84 strong       → primary (violet)
//   50-69 moderate     → amber
//   <50   weak         → muted
//
// Rendered inline next to the ticker so the layout stays compact:
//
//   AAPL · 82
//
// When `score` is null (no snapshot yet — bot hasn't refreshed this
// ticker), we render a quiet "—" so the absence is visible but not
// alarming.

import { cn } from "@/lib/utils";

export type ConvictionLabel =
  | "very strong"
  | "strong"
  | "moderate"
  | "weak"
  | null;

export function labelForScore(score: number | null): ConvictionLabel {
  if (score == null) return null;
  if (score >= 85) return "very strong";
  if (score >= 70) return "strong";
  if (score >= 50) return "moderate";
  return "weak";
}

const TONE: Record<NonNullable<ConvictionLabel>, string> = {
  "very strong": "border-emerald-400/40 text-emerald-300 bg-emerald-400/10",
  strong: "border-primary/40 text-primary bg-primary/10",
  moderate: "border-amber-400/30 text-amber-300 bg-amber-400/10",
  weak: "border-border/60 text-muted-foreground bg-muted/30",
};

export function ConvictionBadge({
  ticker,
  score,
  className,
}: {
  ticker: string;
  score: number | null;
  className?: string;
}) {
  const label = labelForScore(score);
  const tone = label
    ? TONE[label]
    : "border-border/60 text-muted-foreground bg-card/40";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-[11px] px-2 py-0.5 rounded border",
        tone,
        className,
      )}
      title={
        score == null
          ? `${ticker} — no conviction snapshot yet`
          : `${ticker} — conviction ${score}/100 (${label})`
      }
    >
      <span>{ticker}</span>
      <span className="opacity-70 tabular-nums">
        {score == null ? "—" : score}
      </span>
    </span>
  );
}
