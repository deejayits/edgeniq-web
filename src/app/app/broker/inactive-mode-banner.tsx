"use client";

// Banner shown at the top of either tab when the user is viewing
// settings for a mode that is NOT the current order-routing target.
// Stops the user from getting the false impression that toggling
// auto-trade in the inactive tab will make signals fire — it
// configures persisted state but doesn't route orders until the
// user explicitly switches to that mode.
//
// Two flavors:
//   Paper tab + Live active  → amber notice + "Switch to Paper" CTA.
//                              Switching to paper is always allowed
//                              (no gate), so the CTA can fire
//                              immediately.
//   Live tab + Paper active  → amber notice only. Switching to live
//                              has gates (disclaimer, connection,
//                              caps) that are handled by the
//                              LiveView state machine + LiveModeSwitcher
//                              below the banner.

import { useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { switchToPaper } from "./live-actions";

export function InactiveModeBanner({
  visibleTab,
  activeMode,
}: {
  visibleTab: "paper" | "live";
  activeMode: "paper" | "live";
}) {
  const [isPending, startTransition] = useTransition();

  const handleSwitchToPaper = () => {
    startTransition(async () => {
      const res = await switchToPaper();
      toast[res.ok ? "success" : "error"](
        res.ok ? "Switched back to Paper" : res.error,
      );
    });
  };

  const viewingLabel = visibleTab === "live" ? "Live" : "Paper";
  const activeLabel = activeMode === "live" ? "Live" : "Paper";

  return (
    <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-5 py-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 text-sm leading-relaxed">
          <span className="text-amber-100">
            You&rsquo;re viewing <b>{viewingLabel}</b> settings, but{" "}
            <b>{activeLabel}</b> is the active routing mode.
          </span>{" "}
          <span className="text-amber-200/80">
            Changes here are saved as configuration but won&rsquo;t fire
            until you switch to {viewingLabel}.
          </span>
        </div>
        {/* CTA only when paper-bound; live switch has gates handled
            by the LiveView state machine below. */}
        {visibleTab === "paper" && activeMode === "live" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSwitchToPaper}
            disabled={isPending}
            className="border-amber-400/40 text-amber-100 hover:bg-amber-400/15 shrink-0"
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <Shield className="h-3.5 w-3.5 mr-1.5" />
            )}
            Switch to Paper
          </Button>
        )}
      </div>
    </div>
  );
}
