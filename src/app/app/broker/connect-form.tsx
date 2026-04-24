"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExternalLink } from "lucide-react";
import { testAlpacaConnection, saveAlpacaConnection } from "./actions";

// Two-step connect flow: test → save. "Test connection" validates the
// key/secret with Alpaca before we persist — no point writing dud
// credentials to the DB.
export function ConnectForm() {
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [testResult, setTestResult] = useState<
    { accountId: string; buyingPower: string; status: string } | null
  >(null);
  const [isPending, startTransition] = useTransition();

  const handleTest = () => {
    setTestResult(null);
    startTransition(async () => {
      const res = await testAlpacaConnection(apiKey, apiSecret);
      if (res.ok && res.data) {
        setTestResult(res.data);
        toast.success("Connection verified");
      } else {
        toast.error(res.ok ? "Test failed" : res.error);
      }
    });
  };

  const handleSave = () => {
    startTransition(async () => {
      const res = await saveAlpacaConnection(apiKey, apiSecret);
      if (res.ok) {
        toast.success("Connected to Alpaca Paper");
        setApiKey("");
        setApiSecret("");
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="space-y-5">
      <Alert className="border-amber-500/30 bg-amber-500/5">
        <AlertDescription className="text-xs leading-relaxed text-amber-200/90">
          <b>Paper trading only for now.</b> No real money at risk.
          Paper keys start with <code>PK</code> — NOT <code>AK</code>.
          Live trading will become available under a separate pricing
          tier once the billing flow and typed-confirmation UX ship.
        </AlertDescription>
      </Alert>

      <div className="text-sm space-y-3">
        <p className="font-medium">How to get your Alpaca paper keys:</p>
        <ol className="list-decimal pl-5 space-y-1.5 text-sm text-muted-foreground leading-relaxed">
          <li>
            Go to{" "}
            <a
              href="https://app.alpaca.markets/paper/dashboard/overview"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline-offset-2 hover:underline"
            >
              app.alpaca.markets/paper/dashboard
              <ExternalLink className="inline h-3 w-3 ml-0.5" />
            </a>{" "}
            (create a free account if you don&rsquo;t have one).
          </li>
          <li>
            On the right sidebar, click <b>&ldquo;Generate New Key&rdquo;</b>{" "}
            under <b>&ldquo;Your API Keys&rdquo;</b>.
          </li>
          <li>
            Copy the <b>Key ID</b> (starts with <code>PK</code>) and the{" "}
            <b>Secret Key</b>. The secret is shown <i>only once</i> —
            save it somewhere before you close the modal.
          </li>
          <li>
            Paste them below, tap <b>Test connection</b>, then <b>Save</b>.
          </li>
        </ol>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="api-key">API Key ID</Label>
          <Input
            id="api-key"
            placeholder="PKXXXXXXXXXXXXXXXXXX"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setTestResult(null);
            }}
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="api-secret">Secret Key</Label>
          <Input
            id="api-secret"
            type="password"
            placeholder="••••••••••••••••••••••••••••••••"
            value={apiSecret}
            onChange={(e) => {
              setApiSecret(e.target.value);
              setTestResult(null);
            }}
            spellCheck={false}
            autoComplete="off"
          />
        </div>
      </div>

      {testResult && (
        <Alert className="border-emerald-400/30 bg-emerald-400/5">
          <AlertDescription className="text-xs text-emerald-200/90">
            ✓ Verified · Alpaca account <code>{testResult.accountId}</code> ·
            status <b>{testResult.status}</b> · buying power{" "}
            <b>${Number(testResult.buyingPower).toLocaleString()}</b>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleTest}
          disabled={isPending || !apiKey || !apiSecret}
          className="flex-1"
        >
          Test connection
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={isPending || !testResult}
          className="flex-1"
        >
          Save &amp; connect
        </Button>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Credentials are encrypted (AES-256-GCM) before being written to
        our database. The plaintext exists only in server memory during
        trade execution. <b>Never</b> enters the browser after you paste
        it.
      </p>
    </div>
  );
}
