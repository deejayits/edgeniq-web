// Compact stat tile used in the right rail of dashboard page headers
// (Portfolio, History, eventually others). Shows a single number with
// a label and a tinted sub-line for context — designed to fill the
// dead-space-on-the-right that page headers had been wasting on a
// 1280px container.

import { cn } from "@/lib/utils";

const SUB_TONE: Record<
  "emerald" | "rose" | "amber" | "primary" | "muted",
  string
> = {
  emerald: "text-emerald-300",
  rose: "text-rose-300",
  amber: "text-amber-300",
  primary: "text-primary",
  muted: "text-muted-foreground",
};

export function HeaderStat({
  label,
  value,
  sub,
  tone = "muted",
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: keyof typeof SUB_TONE;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-border/60 bg-card/50 px-4 py-3 min-w-[7.5rem] text-right",
        className,
      )}
    >
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">
        {label}
      </div>
      <div className="text-2xl font-semibold tabular-nums leading-none">
        {value}
      </div>
      {sub && (
        <div
          className={cn("text-xs tabular-nums mt-1", SUB_TONE[tone])}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
