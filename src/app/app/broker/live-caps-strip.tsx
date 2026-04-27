// Compact stat strip showing the active live caps. Shown above-the-
// fold on the Live tab when active_broker_mode='live' so users see
// the hard limits at a glance without scrolling. The full editor
// (with input fields) stays further down for actual editing.

import { Card } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

export function LiveCapsStrip({
  positionUsd,
  dailyLossUsd,
  openPositions,
  confirmationLevel,
}: {
  positionUsd: number;
  dailyLossUsd: number;
  openPositions: number;
  confirmationLevel: "strict" | "standard";
}) {
  const fmtDollar = (n: number) =>
    n === Math.floor(n)
      ? `$${n}`
      : `$${n.toFixed(2)}`;
  return (
    <Card className="px-5 py-4 border-border/60 bg-card/40">
      <div className="flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
          Active risk caps
        </div>
        <Item label="Per-order" value={fmtDollar(positionUsd)} />
        <Item label="Daily loss" value={fmtDollar(dailyLossUsd)} />
        <Item label="Max open" value={`${openPositions}`} />
        <Item
          label="Confirm"
          value={confirmationLevel}
          uppercase
        />
      </div>
    </Card>
  );
}

function Item({
  label,
  value,
  uppercase,
}: {
  label: string;
  value: string;
  uppercase?: boolean;
}) {
  return (
    <div className="text-sm tabular-nums">
      <span className="text-muted-foreground mr-1.5">{label}</span>
      <span
        className={`font-semibold text-foreground ${uppercase ? "uppercase text-xs" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
