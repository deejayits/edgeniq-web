"use client";

import { useTransition } from "react";
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
import { CircleCheck } from "lucide-react";
import { disconnectBroker } from "./actions";

export function ConnectedHeader({
  accountId,
  accountStatus,
  buyingPower,
  connectedAt,
}: {
  accountId: string | null;
  accountStatus: string | null;
  buyingPower: number | null;
  connectedAt: string;
}) {
  const [isPending, startTransition] = useTransition();

  const handleDisconnect = () => {
    startTransition(async () => {
      const res = await disconnectBroker();
      toast[res.ok ? "success" : "error"](
        res.ok ? "Disconnected" : res.error,
      );
    });
  };

  return (
    <Card className="p-6 border-emerald-400/30 bg-emerald-400/5 flex items-start gap-4">
      <div className="h-10 w-10 rounded-md bg-emerald-400/15 border border-emerald-400/30 flex items-center justify-center shrink-0">
        <CircleCheck className="h-5 w-5 text-emerald-300" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-medium">Connected to Alpaca</h3>
          <Badge className="bg-primary/15 text-primary border border-primary/30 text-[10px] py-0 h-5">
            paper
          </Badge>
          {accountStatus && (
            <Badge variant="outline" className="text-[10px] py-0 h-5">
              {accountStatus}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Account <code>{accountId ?? "—"}</code> · buying power{" "}
          <b className="text-foreground">
            ${(buyingPower ?? 0).toLocaleString()}
          </b>{" "}
          at connect time · since{" "}
          {new Date(connectedAt).toLocaleDateString()}
        </p>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" disabled={isPending}>
            Disconnect
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Alpaca?</AlertDialogTitle>
            <AlertDialogDescription>
              Your encrypted credentials stay in our database but all
              auto-trade rules stop executing. Existing open Alpaca orders
              are <b>not</b> canceled — use the kill switch for that.
              Reconnect anytime by pasting the same keys.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              disabled={isPending}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
