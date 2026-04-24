"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Check, Plus, Bell, Zap, Lock } from "lucide-react";
import {
  followTarget,
  unfollowTarget,
  toggleMimic,
} from "./actions";

type Props = {
  targetId: string;
  displayName: string;
  isFollowed: boolean;
  alertOnTrades: boolean;
  mimicOnTrades: boolean;
  hasLiveAddon: boolean;
};

// Inline follow / alert / mimic controls shown on the target detail
// page. Mimic toggle is disabled when the user doesn't have the
// Live Trading add-on — with a visible lock icon explaining why.
export function FollowControls({
  targetId,
  displayName,
  isFollowed,
  alertOnTrades,
  mimicOnTrades,
  hasLiveAddon,
}: Props) {
  const [localFollowed, setLocalFollowed] = useState(isFollowed);
  const [localMimic, setLocalMimic] = useState(mimicOnTrades);
  const [isPending, startTransition] = useTransition();

  const handleToggleFollow = () => {
    startTransition(async () => {
      if (localFollowed) {
        const res = await unfollowTarget(targetId);
        if (res.ok) {
          setLocalFollowed(false);
          setLocalMimic(false);
          toast.success(`Unfollowed ${displayName}`);
        } else {
          toast.error(res.error);
        }
      } else {
        const res = await followTarget(targetId, {
          alertOnTrades: true,
          mimicOnTrades: false,
        });
        if (res.ok) {
          setLocalFollowed(true);
          toast.success(`Following ${displayName}`);
        } else {
          toast.error(res.error);
        }
      }
    });
  };

  const handleMimicToggle = (next: boolean) => {
    if (next && !hasLiveAddon) {
      toast.error(
        "Mirroring requires the Live Trading add-on. Contact admin to enable.",
      );
      return;
    }
    startTransition(async () => {
      const res = await toggleMimic(targetId, next);
      if (res.ok) {
        setLocalMimic(next);
        toast.success(
          next
            ? `Mirroring ${displayName}'s trades`
            : `Stopped mirroring ${displayName}`,
        );
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Card className="p-5 border-border/60 bg-card/40 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-medium text-sm">Follow settings</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Get alerts on new trades and optionally mirror them
            automatically.
          </p>
        </div>
        <Button
          size="sm"
          variant={localFollowed ? "default" : "outline"}
          onClick={handleToggleFollow}
          disabled={isPending}
        >
          {localFollowed ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Following
            </>
          ) : (
            <>
              <Plus className="h-3.5 w-3.5" />
              Follow
            </>
          )}
        </Button>
      </div>

      {localFollowed && (
        <div className="space-y-3 pt-1">
          {/* Alert toggle */}
          <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2.5">
            <div className="flex items-start gap-3">
              <Bell className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <Label className="text-sm">Alert on new trades</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Telegram message when a new disclosure hits.
                </p>
              </div>
            </div>
            <Switch checked={alertOnTrades} disabled aria-label="Alert toggle (managed server-side)" />
          </div>

          {/* Mimic toggle */}
          <div
            className={`flex items-center justify-between rounded-md border px-3 py-2.5 ${
              hasLiveAddon
                ? "border-border/60"
                : "border-amber-500/20 bg-amber-500/5"
            }`}
          >
            <div className="flex items-start gap-3">
              {hasLiveAddon ? (
                <Zap className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
              ) : (
                <Lock className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Mirror their trades</Label>
                  {!hasLiveAddon && (
                    <Badge
                      variant="outline"
                      className="text-[10px] py-0 h-4 border-amber-500/40 text-amber-300 bg-amber-500/10"
                    >
                      Live add-on required
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Auto-submits a matching Alpaca order (sized by your
                  auto-trade rules) whenever they disclose a trade.
                  {!hasLiveAddon && (
                    <>
                      {" "}
                      Requires the <b>Live Trading add-on</b>{" "}
                      (+$49.99/mo) since it places real-account orders.
                    </>
                  )}
                </p>
              </div>
            </div>
            <Switch
              checked={localMimic}
              onCheckedChange={handleMimicToggle}
              disabled={isPending || !hasLiveAddon}
            />
          </div>
        </div>
      )}
    </Card>
  );
}
