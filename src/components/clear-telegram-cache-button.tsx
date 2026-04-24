"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink, RefreshCw } from "lucide-react";

// Help users switch Telegram accounts on the Login Widget.
//
// HARD TRUTH: Telegram stores the widget's authorization in a cookie
// on its own domain (oauth.telegram.org). Same-Origin Policy means we
// can't clear that cookie from edgeniq.com with any JS trick — it
// has to be cleared on Telegram's side or via browser dev tools.
//
// So this component offers the two real working paths from a desktop
// browser, plus a "reload widget" button for after the user has
// cleared it via either path.
export function ClearTelegramCacheButton() {
  const [showInstructions, setShowInstructions] = useState(false);

  const onReload = () => {
    window.location.reload();
  };

  return (
    <div className="space-y-2">
      {!showInstructions ? (
        <Button
          onClick={() => setShowInstructions(true)}
          variant="outline"
          size="sm"
          className="w-full"
        >
          Show me how to switch accounts
        </Button>
      ) : (
        <div className="rounded-md border border-border/60 bg-muted/30 px-4 py-3 text-xs text-muted-foreground leading-relaxed space-y-3">
          <div>
            <p className="font-medium text-foreground mb-1.5">
              Pick whichever is fastest:
            </p>
          </div>

          <div>
            <p className="text-foreground font-medium">
              Option A — Incognito / private window
            </p>
            <p>
              Open this page in a new private window. The widget starts
              fresh with no cached identity.
            </p>
          </div>

          <div>
            <p className="text-foreground font-medium">
              Option B — Revoke in Telegram Web
            </p>
            <p className="mb-1.5">
              Open Telegram Web and sign out of{" "}
              <code>@edgeniq_alerts_bot</code>&rsquo;s login session.
            </p>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs"
            >
              <a
                href="https://web.telegram.org/"
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink className="h-3 w-3" />
                Open Telegram Web
              </a>
            </Button>
            <p className="mt-1.5">
              Go to <b>Settings</b> (☰ menu) &rarr;{" "}
              <b>Privacy &amp; Security</b> &rarr; <b>Active Sessions</b>
              , find the browser session, and terminate. Or find the
              chat with the bot and use <code>/stop</code>.
            </p>
          </div>

          <div>
            <p className="text-foreground font-medium">
              Option C — Clear browser cookies
            </p>
            <p>
              In site settings for this page, clear cookies for{" "}
              <code>telegram.org</code>. In Chrome: click the padlock
              in the address bar &rarr; <b>Cookies and site data</b>{" "}
              &rarr; remove entries for <code>telegram.org</code>.
            </p>
          </div>

          <Button
            onClick={onReload}
            variant="outline"
            size="sm"
            className="w-full"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Done — reload widget
          </Button>
        </div>
      )}
    </div>
  );
}
