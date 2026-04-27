"use client";

import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateLiveCaps } from "./live-actions";

// Caps editor — displayed once a live connection is saved. Inputs
// are bounded to the SAME ranges enforced by the SQL CHECK
// constraints (25..10000 for position, 50..10000 for daily loss,
// 1..10 for open positions). Server action re-validates anyway, so
// the client-side bounds are UX hints not security guards.

type CapsState = {
  position_usd: number;
  daily_loss_usd: number;
  open_positions: number;
  confirmation_level: "strict" | "standard";
};

export function LiveCapsEditor({ initial }: { initial: CapsState }) {
  const [draft, setDraft] = useState<CapsState>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const dirty =
    draft.position_usd !== initial.position_usd ||
    draft.daily_loss_usd !== initial.daily_loss_usd ||
    draft.open_positions !== initial.open_positions ||
    draft.confirmation_level !== initial.confirmation_level;

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const res = await updateLiveCaps(draft);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSavedAt(Date.now());
      // Auto-clear the green tick after 3s.
      setTimeout(() => setSavedAt(null), 3000);
    });
  }

  return (
    <Card className="p-6 border-border/60 bg-card/50">
      <div className="mb-5">
        <h2 className="text-base font-semibold">Risk caps</h2>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          Hard limits on every live order. The bot rejects any order
          that would breach these — no exceptions, no overrides.
          Defaults are conservative; raise only after you&rsquo;re
          comfortable with how live orders flow.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <CapInput
          label="Max position size"
          unit="USD"
          value={draft.position_usd}
          min={25}
          max={10_000}
          step={25}
          help="Per-order cap. The bot will size DOWN to this if the signal asks for more."
          onChange={(v) => setDraft((d) => ({ ...d, position_usd: v }))}
          disabled={pending}
        />
        <CapInput
          label="Daily loss limit"
          unit="USD"
          value={draft.daily_loss_usd}
          min={50}
          max={10_000}
          step={50}
          help="Live mode auto-disables for the rest of the trading day if realised + unrealised losses cross this."
          onChange={(v) => setDraft((d) => ({ ...d, daily_loss_usd: v }))}
          disabled={pending}
        />
        <CapInput
          label="Max open positions"
          unit="positions"
          value={draft.open_positions}
          min={1}
          max={10}
          step={1}
          help="If you already hold this many live positions, new signals skip until one closes."
          onChange={(v) => setDraft((d) => ({ ...d, open_positions: v }))}
          disabled={pending}
        />
        <ConfirmationLevelSelect
          value={draft.confirmation_level}
          onChange={(v) =>
            setDraft((d) => ({ ...d, confirmation_level: v }))
          }
          disabled={pending}
        />
      </div>

      {error && (
        <div className="text-xs text-rose-300 mt-4">{error}</div>
      )}

      <div className="flex items-center justify-end gap-3 mt-6">
        {savedAt && !dirty && (
          <span className="text-xs text-emerald-300">Saved</span>
        )}
        <Button
          type="button"
          onClick={handleSave}
          disabled={pending || !dirty}
          variant="outline"
          size="sm"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
          ) : (
            <Save className="h-3.5 w-3.5 mr-1.5" />
          )}
          Save caps
        </Button>
      </div>
    </Card>
  );
}

function CapInput({
  label,
  unit,
  value,
  min,
  max,
  step,
  help,
  onChange,
  disabled,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  help: string;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-sm">{label}</Label>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {unit}
        </span>
      </div>
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        className="tabular-nums"
      />
      <p className="text-[11px] text-muted-foreground leading-snug">
        {help}{" "}
        <span className="opacity-60">
          (range: {min.toLocaleString()}–{max.toLocaleString()})
        </span>
      </p>
    </div>
  );
}

function ConfirmationLevelSelect({
  value,
  onChange,
  disabled,
}: {
  value: "strict" | "standard";
  onChange: (v: "strict" | "standard") => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">Confirmation level</Label>
      <div className="inline-flex rounded-md border border-border/60 bg-card overflow-hidden w-full">
        {(["strict", "standard"] as const).map((opt) => (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt)}
            className={`flex-1 px-3 py-2 text-sm capitalize transition border-r border-border/40 last:border-0 disabled:opacity-50 ${
              value === opt
                ? "bg-rose-500/15 text-rose-200"
                : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug">
        Strict requires per-order multi-tap confirmation on Telegram.
        Standard is single-tap. Strict is recommended until you trust
        the bot&rsquo;s sizing.
      </p>
    </div>
  );
}
