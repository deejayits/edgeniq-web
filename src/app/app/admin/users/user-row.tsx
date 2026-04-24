"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  setUserPlan,
  setUserStatus,
  expireUser,
} from "./actions";

export type AdminUserRowData = {
  chatId: number;
  username: string;
  name: string;
  status: string;
  role: string;
  subPlan: string;
  subStatus: string;
  subExpiresAt: string | null;
  lastSeenAt: string | null;
  signalsReceived: number;
  watchlistCount: number;
};

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function trialDaysLeft(iso: string | null): number | null {
  if (!iso) return null;
  const exp = new Date(iso).getTime();
  if (Number.isNaN(exp)) return null;
  return Math.ceil((exp - Date.now()) / 86_400_000);
}

export function AdminUserRow({ u }: { u: AdminUserRowData }) {
  const [isPending, startTransition] = useTransition();
  const [localPlan, setLocalPlan] = useState(u.subPlan);
  const suspended = u.status === "suspended";
  const isAdmin = u.role === "admin" || u.role === "primary_admin";

  const handlePlanChange = (plan: string) => {
    setLocalPlan(plan);
    startTransition(async () => {
      const res = await setUserPlan(u.chatId, plan);
      if (res.ok) {
        toast.success(`${u.username || `#${u.chatId}`} → ${plan}`);
      } else {
        toast.error(res.error ?? "failed");
        setLocalPlan(u.subPlan); // revert optimistic change
      }
    });
  };

  const handleExpire = () => {
    if (!confirm(`Expire ${u.username || `#${u.chatId}`}'s access?`)) return;
    startTransition(async () => {
      const res = await expireUser(u.chatId);
      toast[res.ok ? "success" : "error"](
        res.ok ? "access revoked" : res.error ?? "failed",
      );
    });
  };

  const handleSuspendToggle = () => {
    const next = suspended ? "active" : "suspended";
    const verb = suspended ? "Restore" : "Suspend";
    if (!confirm(`${verb} ${u.username || `#${u.chatId}`}?`)) return;
    startTransition(async () => {
      const res = await setUserStatus(u.chatId, next);
      toast[res.ok ? "success" : "error"](
        res.ok ? `${verb.toLowerCase()}d` : res.error ?? "failed",
      );
    });
  };

  const days = trialDaysLeft(u.subExpiresAt);

  return (
    <tr className="border-b border-border/40 last:border-0 hover:bg-muted/10 transition">
      {/* User identity */}
      <td className="px-5 py-3">
        <div className="flex flex-col">
          <span className="font-medium">
            {u.name || u.username || `#${u.chatId}`}
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            @{u.username || "—"} · {u.chatId}
          </span>
        </div>
      </td>

      {/* Role */}
      <td className="px-4 py-3">
        {isAdmin ? (
          <Badge
            variant="outline"
            className="border-amber-400/40 text-amber-300 bg-amber-400/10"
          >
            {u.role === "primary_admin" ? "primary" : "admin"}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">user</span>
        )}
      </td>

      {/* Plan dropdown */}
      <td className="px-4 py-3">
        {isAdmin ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <Select
            value={localPlan}
            onValueChange={handlePlanChange}
            disabled={isPending}
          >
            <SelectTrigger className="h-8 w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="elite">Elite</SelectItem>
            </SelectContent>
          </Select>
        )}
      </td>

      {/* Subscription status */}
      <td className="px-4 py-3">
        {isAdmin ? (
          // Admins bypass tier gating entirely — any trial/expired
          // flag on their row is leftover from onboarding and doesn't
          // affect anything. Render em-dash so the table isn't
          // misleading ("admin with 30d left" is meaningless).
          <span className="text-xs text-muted-foreground">—</span>
        ) : u.subStatus === "trial" ? (
          <Badge className="bg-emerald-400/15 text-emerald-300 border border-emerald-400/30">
            trial · {days !== null && days >= 0 ? `${days}d left` : "—"}
          </Badge>
        ) : u.subStatus === "expired" ? (
          <Badge
            variant="outline"
            className="border-rose-400/40 text-rose-300 bg-rose-400/10"
          >
            expired
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            {u.subStatus}
          </Badge>
        )}
      </td>

      {/* Account status */}
      <td className="px-4 py-3">
        {suspended ? (
          <Badge
            variant="outline"
            className="border-rose-400/40 text-rose-300 bg-rose-400/10"
          >
            suspended
          </Badge>
        ) : u.status === "active" ? (
          <Badge
            variant="outline"
            className="border-border/60 text-muted-foreground"
          >
            active
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            {u.status}
          </Badge>
        )}
      </td>

      {/* Last seen */}
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {relativeTime(u.lastSeenAt)}
      </td>

      {/* Signals + watchlist size */}
      <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
        {u.signalsReceived.toLocaleString()} sig · {u.watchlistCount} ticker
        {u.watchlistCount === 1 ? "" : "s"}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        {!isAdmin && (
          <div className="flex items-center gap-2 justify-end">
            {u.subStatus !== "expired" && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleExpire}
                disabled={isPending}
                className="h-7 text-xs"
              >
                Revoke
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleSuspendToggle}
              disabled={isPending}
              className="h-7 text-xs"
            >
              {suspended ? "Restore" : "Suspend"}
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}
