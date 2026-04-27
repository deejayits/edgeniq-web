"use client";

// Kill switch for the Live tab. Identical interaction model to
// KillSwitchCard (paper) but routes through engageLiveKillSwitch,
// which:
//   - sets users.live_trading_enabled = false
//   - sets users.active_broker_mode = 'paper' (mode flips back so
//     no further signals route to live)
//   - logs a forensic row to live_trading_events
//
// Phase 4a: doesn't yet cancel open Alpaca live orders since live
// order placement isn't shipped. Phase 4b will add Alpaca cancel-all
// alongside the flag flip. Until then, "Engage" is a logical kill —
// it stops new routing immediately.

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { Power } from "lucide-react";
import { engageLiveKillSwitch } from "./live-actions";

export function LiveKillSwitchCard() {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const handleEngage = () => {
    startTransition(async () => {
      const res = await engageLiveKillSwitch("manual");
      if (res.ok) {
        toast.success("Live trading killed — switched back to paper");
        setOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Card className="p-6 flex flex-col h-full space-y-4 border-rose-400/30 bg-rose-400/5">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-md bg-rose-400/15 border border-rose-400/30 flex items-center justify-center shrink-0">
          <Power className="h-4 w-4 text-rose-300" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium">Live kill switch</h3>
            <Badge
              variant="outline"
              className="text-[10px] py-0 h-5 text-muted-foreground"
            >
              Armed
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Emergency stop. Flips active mode back to Paper, disables
            live trading, and logs the trip. Use the moment something
            looks wrong.
          </p>
        </div>
      </div>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" className="mt-auto w-full">
            <Power className="h-4 w-4" />
            Engage live kill switch
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kill live trading?</AlertDialogTitle>
            <AlertDialogDescription>
              Active mode flips back to Paper immediately. Live
              trading is disabled until you re-opt-in via the
              switch-to-live flow. Existing live positions on Alpaca
              are <b>not</b> closed — use Alpaca to flatten those
              manually if you want out. The forensic event is logged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEngage}
              disabled={isPending}
              className="bg-rose-500/90 hover:bg-rose-500 text-white"
            >
              {isPending ? "…" : "Yes, kill live trading"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
