"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Plus, Check } from "lucide-react";
import { followTarget, unfollowTarget } from "./actions";
import {
  TARGET_TYPE_LABEL,
  type TargetType,
  type TargetWithStats,
} from "./types";

// Compact browse-grid card. One row on /app/smart-money. Shows the
// target's avatar + name + recent activity. Primary action is a
// quick follow toggle; tap the card itself to drill into detail.

const TYPE_ACCENT: Record<TargetType, string> = {
  politician: "bg-violet-400/15 text-violet-300 border-violet-400/30",
  fund_13f: "bg-emerald-400/15 text-emerald-300 border-emerald-400/30",
  insider: "bg-primary/15 text-primary border-primary/30",
  activist: "bg-amber-400/15 text-amber-300 border-amber-400/30",
};

function avatarInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function TargetCard({ target }: { target: TargetWithStats }) {
  const [isPending, startTransition] = useTransition();

  const handleFollowToggle = (e: React.MouseEvent) => {
    // Don't trigger the surrounding <Link> when clicking the follow
    // button — the card wraps the whole row in a link to the detail
    // page.
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      const res = target.is_followed
        ? await unfollowTarget(target.id)
        : await followTarget(target.id, {
            alertOnTrades: true,
            mimicOnTrades: false,
          });
      if (res.ok) {
        toast.success(
          target.is_followed
            ? `Unfollowed ${target.display_name}`
            : `Following ${target.display_name} — alerts enabled`,
        );
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Link
      href={`/app/smart-money/${target.id}`}
      className="block group"
      aria-label={`View ${target.display_name}'s activity`}
    >
      <Card className="p-5 border-border/60 bg-card/40 transition hover:border-primary/40 hover:bg-card/70 h-full">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="h-11 w-11 rounded-lg bg-gradient-to-br from-emerald-400/15 to-violet-400/15 border border-border/60 flex items-center justify-center text-sm font-semibold shrink-0">
            {target.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={target.avatar_url}
                alt={target.display_name}
                className="h-full w-full rounded-lg object-cover"
              />
            ) : (
              avatarInitials(target.display_name)
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium truncate">
                {target.display_name}
              </h3>
              <Badge
                variant="outline"
                className={`text-[10px] py-0 h-4 ${TYPE_ACCENT[target.target_type]}`}
              >
                {TARGET_TYPE_LABEL[target.target_type]}
              </Badge>
            </div>
            {target.subtitle && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {target.subtitle}
              </p>
            )}

            <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
              {target.trade_count_30d > 0 ? (
                <>
                  <span>
                    <b className="text-foreground tabular-nums">
                      {target.trade_count_30d}
                    </b>{" "}
                    trade{target.trade_count_30d === 1 ? "" : "s"} · 30d
                  </span>
                  {target.top_symbols.length > 0 && (
                    <span className="font-mono truncate">
                      {target.top_symbols.slice(0, 3).join(" · ")}
                    </span>
                  )}
                </>
              ) : target.target_type === "politician" ||
                target.target_type === "insider" ||
                target.target_type === "activist" ? (
                <span className="italic">
                  Data ingestion coming soon
                </span>
              ) : (
                <span className="italic">Pending next SEC cron</span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <Button
              size="sm"
              variant={target.is_followed ? "default" : "outline"}
              className="h-8 text-xs"
              onClick={handleFollowToggle}
              disabled={isPending}
            >
              {target.is_followed ? (
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
            {target.mimic_enabled && (
              <Badge className="bg-emerald-400/15 text-emerald-300 border border-emerald-400/30 text-[10px] py-0 h-4">
                mirroring
              </Badge>
            )}
            <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition flex items-center gap-0.5">
              View <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
