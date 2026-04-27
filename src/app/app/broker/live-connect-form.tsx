"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  saveLiveAlpacaConnection,
  testLiveAlpacaConnection,
} from "./live-actions";

// Same shape as the paper ConnectForm but separate file because:
//   - tests/saves to api.alpaca.markets (live), not paper-api
//   - copy emphasizes "LIVE" and "REAL MONEY" in multiple places
//   - red theming so users can't visually confuse it with paper
//
// Critical safety: the underlying server action calls Alpaca's
// account endpoint via the live URL. Pasting a paper key will return
// 401/403 from Alpaca and we surface a specific error pointing at
// the mistake. Pasting a live key into the paper form would also
// fail the same way. Wrong-mode keys can never be saved.

export function LiveConnectForm() {
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tested, setTested] = useState<{
    accountId: string;
    buyingPower: string;
    status: string;
  } | null>(null);

  function handleTest() {
    if (!apiKey.trim() || !apiSecret.trim()) {
      setError("Both fields are required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await testLiveAlpacaConnection(apiKey, apiSecret);
      if (!res.ok) {
        setError(res.error);
        setTested(null);
        return;
      }
      setTested(res.data!);
    });
  }

  function handleSave() {
    if (!tested) {
      setError("Test the connection first.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await saveLiveAlpacaConnection(apiKey, apiSecret);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Server action revalidates → page re-renders into READY_TO_SWITCH.
    });
  }

  return (
    <Card className="p-6 border-rose-500/30 bg-rose-500/5">
      <div className="flex items-start gap-3 mb-4">
        <AlertTriangle className="h-5 w-5 text-rose-300 shrink-0 mt-0.5" />
        <div>
          <h2 className="text-lg font-semibold">Connect LIVE Alpaca</h2>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            This is your real-money Alpaca key — distinct from the
            paper key. Pasting a paper key here will fail (Alpaca
            returns 401). Get yours at{" "}
            <a
              href="https://app.alpaca.markets/paper/dashboard/overview"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              app.alpaca.markets
            </a>{" "}
            (your account dropdown → Live, then API keys section).
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="live-api-key">Live API key</Label>
          <Input
            id="live-api-key"
            type="text"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              if (error) setError(null);
              if (tested) setTested(null);
            }}
            disabled={pending}
            placeholder="PKxxxxxxxxxxxxxxxxxx"
            className="font-mono text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="live-api-secret">Live API secret</Label>
          <Input
            id="live-api-secret"
            type="password"
            value={apiSecret}
            onChange={(e) => {
              setApiSecret(e.target.value);
              if (error) setError(null);
              if (tested) setTested(null);
            }}
            disabled={pending}
            placeholder="••••••••••••••••••••••••"
            className="font-mono text-sm"
          />
        </div>

        {error && (
          <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        {tested && (
          <div className="text-xs bg-emerald-400/10 border border-emerald-400/30 rounded-md px-3 py-3 space-y-1">
            <div className="flex items-center gap-2 text-emerald-300 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Connection verified
            </div>
            <div className="text-muted-foreground font-mono">
              Account: {tested.accountId}
            </div>
            <div className="text-muted-foreground tabular-nums">
              Status: {tested.status} · Buying power: $
              {Number(tested.buyingPower).toLocaleString()}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={handleTest}
            disabled={pending || !apiKey.trim() || !apiSecret.trim()}
          >
            {pending && !tested ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : null}
            Test connection
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={pending || !tested}
            className="bg-rose-500/15 text-rose-200 border border-rose-500/40 hover:bg-rose-500/25 disabled:opacity-40"
            variant="outline"
          >
            {pending && tested ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : null}
            Save live connection
          </Button>
        </div>
      </div>
    </Card>
  );
}
