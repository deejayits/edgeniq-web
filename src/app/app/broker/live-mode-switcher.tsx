"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, ArrowRight, Loader2, Shield } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { switchToLive, switchToPaper } from "./live-actions";

// The actual mode-flip button. Two variants:
//
//   active='paper' → "Switch to Live" (BIG red button, AlertDialog
//                    confirm). Walks the SQL-side gate check before
//                    flipping; ANY failure leaves user in paper mode.
//
//   active='live'  → "Switch back to Paper" (calm green-leaning
//                    button, single confirm). Always allowed.
//
// Switching is the EXPLICIT action — tabs at the top of /app/broker
// just change which view you SEE, not which mode is ACTIVE. Visual
// state and routing state are decoupled on purpose so a stray tab
// click can't put real money on the line.

export function LiveModeSwitcher({
  activeMode,
  confirmationLevel,
}: {
  activeMode: "paper" | "live";
  confirmationLevel: "strict" | "standard";
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSwitchToLive() {
    setError(null);
    startTransition(async () => {
      const res = await switchToLive({ confirm: true });
      if (!res.ok) setError(res.error);
    });
  }

  function handleSwitchToPaper() {
    setError(null);
    startTransition(async () => {
      const res = await switchToPaper();
      if (!res.ok) setError(res.error);
    });
  }

  if (activeMode === "live") {
    return (
      <Card className="p-5 border-border/60 bg-card/50">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-emerald-300" />
              Switch back to Paper
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Stops all live order routing immediately. Paper auto-trade
              settings are preserved.
            </p>
          </div>
          <Button
            type="button"
            onClick={handleSwitchToPaper}
            disabled={pending}
            variant="outline"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : null}
            Switch to Paper
          </Button>
        </div>
        {error && (
          <div className="text-xs text-rose-300 mt-3">{error}</div>
        )}
      </Card>
    );
  }

  // active === 'paper' → big red "Switch to Live" CTA
  return (
    <Card className="p-6 border-rose-500/40 bg-rose-500/5">
      <div className="flex items-start gap-3 mb-4">
        <AlertTriangle className="h-5 w-5 text-rose-300 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold">Ready to go live</h2>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            Disclaimer signed. Live Alpaca account connected. Caps set
            ({confirmationLevel} confirmation). Switching activates
            real-money order routing for every signal that fires from
            this moment forward.
          </p>
        </div>
      </div>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            disabled={pending}
            className="w-full bg-rose-500/15 text-rose-100 border border-rose-500/50 hover:bg-rose-500/25 disabled:opacity-40 h-11"
            variant="outline"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <ArrowRight className="h-4 w-4 mr-2" />
            )}
            Switch to Live trading
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-300" />
              Activate live trading?
            </AlertDialogTitle>
            <AlertDialogDescription className="leading-relaxed">
              From the moment you confirm, qualifying signals will route
              orders to your <b>live</b> Alpaca account. Real money is
              at risk. Your live-mode rules start <b>opted-out</b> by
              default — nothing fires until you explicitly enable
              auto-trade on the Live tab. Paper rules are preserved
              independently and resume when you switch back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              Stay on paper
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSwitchToLive}
              disabled={pending}
              className="bg-rose-500/20 text-rose-100 border border-rose-500/50 hover:bg-rose-500/30"
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : null}
              Yes, go live
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {error && (
        <div className="text-xs text-rose-300 mt-3">{error}</div>
      )}
    </Card>
  );
}
