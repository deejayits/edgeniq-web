"use client";

// Compact connection summary used by both Paper and Live tabs. The
// previous ConnectedHeader / LiveConnectionSummary components used
// 5-6 vertical lines of chrome to convey "you're connected" — this
// single horizontal strip says the same thing in 2 lines and frees
// up real estate above the fold for the actual control surface
// (auto-trade toggle + kill switch).
//
// Mode-specific styling:
//   Paper → emerald, calm
//   Live  → rose, attention-grabbing
//
// Right-side action varies by mode:
//   Paper → Disconnect (ghost button, destructive confirm)
//   Live  → "Switch to Paper" (when active) or Disconnect (when
//            not the routing target). Switching down should be
//            instant, no confirm — moving toward safer state.

import { useTransition } from "react";
import { toast } from "sonner";
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
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, Shield, Zap } from "lucide-react";
import { disconnectBroker } from "./actions";
import { disconnectLiveBroker, switchToPaper } from "./live-actions";

export function ConnectionStrip({
  mode,
  isActive,
  accountId,
  accountStatus,
  buyingPower,
  connectedAt,
}: {
  mode: "paper" | "live";
  isActive: boolean;
  accountId: string | null;
  accountStatus: string | null;
  buyingPower: number | null;
  connectedAt: string;
}) {
  const [isPending, startTransition] = useTransition();
  const isLive = mode === "live";

  const handleSwitchToPaper = () => {
    startTransition(async () => {
      const res = await switchToPaper();
      toast[res.ok ? "success" : "error"](
        res.ok ? "Switched back to Paper" : res.error,
      );
    });
  };

  const handleDisconnect = () => {
    startTransition(async () => {
      const res = isLive
        ? await disconnectLiveBroker()
        : await disconnectBroker();
      toast[res.ok ? "success" : "error"](
        res.ok ? "Disconnected" : res.error,
      );
    });
  };

  // Tone classes
  const tone = isLive
    ? {
        card: "border-rose-500/40 bg-rose-500/5",
        iconBg: "bg-rose-500/15 border-rose-500/40",
        icon: "text-rose-300",
        title: "Live Alpaca",
      }
    : {
        card: "border-emerald-400/30 bg-emerald-400/5",
        iconBg: "bg-emerald-400/15 border-emerald-400/30",
        icon: "text-emerald-300",
        title: "Paper Alpaca",
      };

  return (
    <Card className={`px-5 py-4 ${tone.card}`}>
      <div className="flex items-center gap-4 flex-wrap">
        <div
          className={`h-9 w-9 rounded-md flex items-center justify-center shrink-0 border ${tone.iconBg}`}
        >
          {isLive ? (
            <Zap className={`h-4 w-4 ${tone.icon}`} />
          ) : (
            <CheckCircle2 className={`h-4 w-4 ${tone.icon}`} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{tone.title}</span>
            {isActive && (
              <Badge
                variant="outline"
                className={
                  isLive
                    ? "border-rose-400/40 text-rose-200 bg-rose-400/10 text-[10px] py-0 h-5"
                    : "border-emerald-400/40 text-emerald-300 bg-emerald-400/10 text-[10px] py-0 h-5"
                }
              >
                <Shield className="h-2.5 w-2.5 mr-1" />
                Active
              </Badge>
            )}
            {accountStatus && (
              <Badge
                variant="outline"
                className="text-[10px] py-0 h-5 text-muted-foreground capitalize"
              >
                {accountStatus.toLowerCase()}
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-1 tabular-nums truncate">
            <code className="text-muted-foreground/80">{accountId ?? "—"}</code>
            {buyingPower != null && (
              <>
                {" · "}${Number(buyingPower).toLocaleString()} buying power
              </>
            )}
            {" · since "}
            {new Date(connectedAt).toLocaleDateString()}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Live + active mode → primary action is "switch to paper"
              (no confirm, friction-free safe-direction switch).
              Disconnect is the secondary destructive action. */}
          {isLive && isActive && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSwitchToPaper}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Shield className="h-3.5 w-3.5" />
              )}
              Switch to Paper
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={isPending}
                className="text-muted-foreground hover:text-foreground"
              >
                Disconnect
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Disconnect {isLive ? "live" : "paper"} Alpaca?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Encrypted credentials stay in our database. Auto-trade
                  rules continue to evaluate, but no new orders will
                  submit on this {isLive ? "live" : "paper"} account
                  until you reconnect. Existing open Alpaca orders are{" "}
                  <b>not</b> canceled — use the kill switch for that.
                  {isLive && (
                    <>
                      {" "}Disconnecting live also forces active mode
                      back to Paper.
                    </>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDisconnect}
                  disabled={isPending}
                >
                  Disconnect
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </Card>
  );
}
