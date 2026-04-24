"use client";

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
import { AlertTriangle, Power } from "lucide-react";
import { engageKillSwitch, releaseKillSwitch } from "./actions";

export function KillSwitchCard({
  engaged,
  engagedAt,
  reason,
}: {
  engaged: boolean;
  engagedAt: string | null;
  reason: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const handleEngage = () => {
    startTransition(async () => {
      const res = await engageKillSwitch("manual");
      if (res.ok) {
        toast.success("Kill switch engaged — all open orders canceled");
        setOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleRelease = () => {
    startTransition(async () => {
      const res = await releaseKillSwitch();
      if (res.ok) {
        toast.success(
          "Kill switch released — remember to re-enable your rules",
        );
      } else {
        toast.error(res.error);
      }
    });
  };

  if (engaged) {
    return (
      <Card className="p-6 flex flex-col h-full space-y-4 border-rose-400/40 bg-rose-400/10">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-md bg-rose-400/20 border border-rose-400/40 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-4 w-4 text-rose-300" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium text-rose-200">Kill switch</h3>
              <Badge className="bg-rose-400/20 text-rose-200 border border-rose-400/40 text-[10px] py-0 h-5">
                Engaged
              </Badge>
            </div>
            <p className="text-xs text-rose-200/80 mt-1 leading-relaxed">
              All open Alpaca orders canceled; rules reset to{" "}
              <b>off</b>. No orders submit until you release.
              {engagedAt && (
                <>
                  <br />
                  Engaged {new Date(engagedAt).toLocaleString()} · reason:{" "}
                  <i>{reason ?? "manual"}</i>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mt-auto pt-2 border-t border-rose-400/20">
          <Button
            onClick={handleRelease}
            disabled={isPending}
            variant="outline"
            className="w-full"
          >
            {isPending ? "…" : "Release kill switch"}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 flex flex-col h-full space-y-4 border-rose-400/30 bg-rose-400/5">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-md bg-rose-400/15 border border-rose-400/30 flex items-center justify-center shrink-0">
          <Power className="h-4 w-4 text-rose-300" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium">Kill switch</h3>
            <Badge
              variant="outline"
              className="text-[10px] py-0 h-5 text-muted-foreground"
            >
              Armed
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Emergency stop. Cancels every open Alpaca order and resets
            all auto-trade rules to off. Use when something looks wrong.
          </p>
        </div>
      </div>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" className="mt-auto w-full">
            <Power className="h-4 w-4" />
            Engage kill switch
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Engage the kill switch?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel every open order on your connected Alpaca
              paper account and flip all of your auto-trade rules to{" "}
              <b>off</b>. Existing filled positions aren&rsquo;t touched —
              you&rsquo;ll need to close those manually in Alpaca if
              you want out. You can release the kill switch later from
              this page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEngage}
              disabled={isPending}
              className="bg-rose-500/90 hover:bg-rose-500 text-white"
            >
              {isPending ? "…" : "Yes, stop everything"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
