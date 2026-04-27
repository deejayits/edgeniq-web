"use client";

// Master kill switch — visible regardless of which tab (paper/live)
// is active. Replaces the per-tab kill switch cards. One unified
// button means users never have to ask "which kill switch do I press
// for the mode I'm in?" at the moment they need to stop everything.
//
// Effects (server side via engageMasterKillSwitch):
//   - Cancels every open Alpaca order on the active connection
//   - Resets every auto_trade_rules.execution_mode to 'off'
//   - Engages auto_trade_risk_rails.kill_switch_engaged
//   - Flips users.live_trading_enabled = false
//   - Flips users.active_broker_mode = 'paper'
//   - Logs a forensic event
//
// Sized small + tucked into the tabs row so it doesn't dominate the
// page chrome but is still 1 click away. Color-flips to engaged-red
// when the rails kill_switch_engaged flag is true so users can see
// the system is locked from anywhere.

import { useState, useTransition } from "react";
import { toast } from "sonner";
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
import { AlertTriangle, Loader2, Power } from "lucide-react";
import { releaseKillSwitch } from "./actions";
import { engageMasterKillSwitch } from "./live-actions";

export function MasterKillSwitch({
  engaged,
  engagedAt,
  reason,
}: {
  engaged: boolean;
  engagedAt: string | null;
  reason: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleEngage = () => {
    startTransition(async () => {
      const res = await engageMasterKillSwitch("manual");
      if (res.ok) {
        toast.success("Kill switch engaged — everything stopped");
        setOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleRelease = () => {
    startTransition(async () => {
      const res = await releaseKillSwitch();
      toast[res.ok ? "success" : "error"](
        res.ok
          ? "Kill switch released — re-enable rules to resume"
          : res.error,
      );
    });
  };

  if (engaged) {
    return (
      <div className="inline-flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs font-medium">
          <AlertTriangle className="h-3.5 w-3.5" />
          Kill switch engaged
          {engagedAt && (
            <span className="text-rose-300/70 font-mono">
              · {new Date(engagedAt).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          )}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRelease}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : null}
          Release
        </Button>
      </div>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-rose-500/40 text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
        >
          <Power className="h-3.5 w-3.5" />
          Kill switch
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-300" />
            Stop everything?
          </AlertDialogTitle>
          <AlertDialogDescription className="leading-relaxed">
            This is the master emergency stop. It will:
            <br />
            <br />
            • Cancel every open order on your active Alpaca account
            <br />
            • Set every auto-trade rule to <b>off</b>
            <br />
            • Disable live trading and switch active mode back to Paper
            <br />
            • Log the event for audit
            <br />
            <br />
            Existing filled positions are <b>not</b> closed — log into
            Alpaca to flatten those if needed. You can release the
            kill switch from this page once the situation is handled.
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
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : null}
            Yes, stop everything
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
