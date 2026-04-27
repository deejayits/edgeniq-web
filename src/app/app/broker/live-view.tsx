// Live mode tab — strict state machine for opting in to live trading.
//
// State sequence (each must be cleared before the next becomes active):
//
//   1. NO_ADDON          — user has Elite but not the Live add-on.
//                          Shows upgrade CTA. No further interaction.
//   2. NEEDS_DISCLAIMER  — addon present but disclaimer not signed
//                          (or version is stale). Shows the multi-
//                          checkbox disclaimer + Accept button.
//   3. NEEDS_CONNECTION  — disclaimer signed but no live broker
//                          connection. Shows the LIVE alpaca-key
//                          form (separate from paper).
//   4. READY_TO_SWITCH   — connection saved AND disclaimer current,
//                          but active_broker_mode is still 'paper'.
//                          Shows the "Switch to Live" confirm button
//                          + caps editor.
//   5. LIVE_ACTIVE       — active_broker_mode = 'live'. Big red
//                          "LIVE — REAL MONEY" banner, kill switch,
//                          caps editor, switch-back-to-paper.
//
// The bot reads active_broker_mode at order time. UI state is purely
// visual; nothing here performs orders.

import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Lock } from "lucide-react";
import { LiveDisclaimerCard } from "./live-disclaimer-card";
import { LiveConnectForm } from "./live-connect-form";
import { LiveCapsEditor } from "./live-caps-editor";
import { LiveModeSwitcher } from "./live-mode-switcher";
import { LiveCapsStrip } from "./live-caps-strip";
import { ConnectionStrip } from "./connection-strip";
import { AutoTradeMasterToggle } from "./master-toggle";
import { LIVE_DISCLAIMER_VERSION } from "./live-config";

export type LiveUserState = {
  hasAddon: boolean;
  liveTradingEnabled: boolean;
  liveAcknowledgedAt: string | null;
  liveAcknowledgedVersion: number;
  activeBrokerMode: "paper" | "live";
  // Caps
  liveMaxPositionUsd: number;
  liveMaxDailyLossUsd: number;
  liveMaxOpenPositions: number;
  liveConfirmationLevel: "strict" | "standard";
};

export type LiveConnection = {
  account_id: string | null;
  account_status: string | null;
  buying_power_at_connect: number | null;
  connected_at: string;
} | null;

export function LiveView({
  user,
  liveConn,
  rulesContext,
}: {
  user: LiveUserState;
  liveConn: LiveConnection;
  /** Auto-trade rule summary surfaced from the parent page so the
      Live tab's master toggle reflects the same per-signal-type
      rules the bot evaluates. Identical shape to what the paper
      tab uses; rules table is shared between modes. */
  rulesContext: {
    anyActive: boolean;
    activeCount: number;
    totalCount: number;
  };
}) {
  // Resolve the state. Order matters — first matching condition wins.
  const state: "NO_ADDON" | "NEEDS_DISCLAIMER" | "NEEDS_CONNECTION" | "READY_TO_SWITCH" | "LIVE_ACTIVE" =
    !user.hasAddon
      ? "NO_ADDON"
      : !user.liveAcknowledgedAt ||
          user.liveAcknowledgedVersion < LIVE_DISCLAIMER_VERSION
        ? "NEEDS_DISCLAIMER"
        : !liveConn
          ? "NEEDS_CONNECTION"
          : user.activeBrokerMode !== "live"
            ? "READY_TO_SWITCH"
            : "LIVE_ACTIVE";

  return (
    <div className="space-y-6">
      {/* Persistent banner — shown ONLY when live is the active mode.
          Big, red, can't-miss. Establishes the "this is real money"
          context for everything below. */}
      {state === "LIVE_ACTIVE" && (
        <Alert className="px-5 py-4 border-rose-500/50 bg-rose-500/10">
          <AlertTriangle className="h-4 w-4 text-rose-300" />
          <AlertDescription className="text-sm leading-relaxed text-rose-200">
            <b className="text-rose-100">LIVE — real money is at risk.</b>{" "}
            Every signal that fires while this is active will route
            through your live Alpaca account. Switch back to Paper any
            time below.
          </AlertDescription>
        </Alert>
      )}

      {state === "NO_ADDON" && <NoAddonCard />}
      {state === "NEEDS_DISCLAIMER" && <LiveDisclaimerCard />}
      {state === "NEEDS_CONNECTION" && <LiveConnectForm />}

      {(state === "READY_TO_SWITCH" || state === "LIVE_ACTIVE") && (
        <>
          {/* 1. Compact connection strip (replaces the old card) */}
          <ConnectionStrip
            mode="live"
            isActive={state === "LIVE_ACTIVE"}
            accountId={liveConn!.account_id}
            accountStatus={liveConn!.account_status}
            buyingPower={liveConn!.buying_power_at_connect}
            connectedAt={liveConn!.connected_at}
          />

          {/* 2. When LIVE is active, show caps strip + auto-trade
                 master toggle. The kill switch lives at page level
                 (next to the tabs) so it's reachable from any tab —
                 we don't need a per-tab copy. */}
          {state === "LIVE_ACTIVE" && (
            <>
              <LiveCapsStrip
                positionUsd={user.liveMaxPositionUsd}
                dailyLossUsd={user.liveMaxDailyLossUsd}
                openPositions={user.liveMaxOpenPositions}
                confirmationLevel={user.liveConfirmationLevel}
              />
              <section className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Auto-trade
                </h2>
                <AutoTradeMasterToggle
                  mode="live"
                  anyActive={rulesContext.anyActive}
                  activeCount={rulesContext.activeCount}
                  totalCount={rulesContext.totalCount}
                />
              </section>
            </>
          )}

          {/* 3. When READY_TO_SWITCH (live connected but mode still
                 paper), the dominant CTA is the mode switcher. Don't
                 show controls + kill switch yet — nothing for them to
                 do until live is the active routing target. */}
          {state === "READY_TO_SWITCH" && (
            <LiveModeSwitcher
              activeMode={user.activeBrokerMode}
              confirmationLevel={user.liveConfirmationLevel}
            />
          )}

          {/* 4. Detailed caps editor — the strip above is read-only,
                 this is where users adjust values. Below the fold is
                 fine since users don't tweak caps every session. */}
          <LiveCapsEditor
            initial={{
              position_usd: user.liveMaxPositionUsd,
              daily_loss_usd: user.liveMaxDailyLossUsd,
              open_positions: user.liveMaxOpenPositions,
              confirmation_level: user.liveConfirmationLevel,
            }}
          />

          {/* 5. When LIVE_ACTIVE, the switcher is the demote-to-paper
                 path. Tucked at the bottom because it's a single-step
                 operation and the connection strip already has the
                 button. Kept here for users who prefer the formal CTA. */}
          {state === "LIVE_ACTIVE" && (
            <LiveModeSwitcher
              activeMode={user.activeBrokerMode}
              confirmationLevel={user.liveConfirmationLevel}
            />
          )}
        </>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// Sub-components below — pure server, no state.
// ----------------------------------------------------------------------

function NoAddonCard() {
  return (
    <Card className="p-8 border-border/60 bg-card/50">
      <div className="flex flex-col items-center text-center gap-3">
        <div className="h-12 w-12 rounded-full bg-amber-400/15 border border-amber-400/40 flex items-center justify-center">
          <Lock className="h-5 w-5 text-amber-300" />
        </div>
        <h2 className="text-lg font-semibold">Live Trading add-on required</h2>
        <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
          Live trading is a paid add-on on top of Elite ($49.99/mo).
          It unlocks the ability to route real-money orders through
          Alpaca&rsquo;s live API. Paper trading remains available
          regardless.
        </p>
        <Badge className="bg-amber-400/15 text-amber-300 border border-amber-400/30 mt-2">
          Add-on · $49.99/mo
        </Badge>
        <Button asChild variant="outline" size="sm" className="mt-2">
          <Link href="/#pricing">See pricing</Link>
        </Button>
      </div>
    </Card>
  );
}

