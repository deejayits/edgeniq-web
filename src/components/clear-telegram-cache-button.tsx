"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LogOut, RefreshCw } from "lucide-react";

// Clears the Telegram Login Widget's cached identity so the user can
// sign in as a different Telegram account. Opens oauth.telegram.org
// in a new tab — that's the domain the widget reads its cookie from,
// and Telegram's own "Log out" button there removes it. We can't
// touch cross-origin cookies from edgeniq.com, so this is the only
// real path from a browser.
//
// Two-step UX:
//   Step 1: Button says "Use a different Telegram account"
//   Step 2: After the new tab opens, the button morphs into
//           "I logged out — reload widget" which hard-reloads the
//           login page so the widget re-reads the (now cleared)
//           Telegram cookie.
export function ClearTelegramCacheButton() {
  const [stage, setStage] = useState<"idle" | "prompted">("idle");

  const onOpenLogout = () => {
    // oauth.telegram.org is where the login widget stores its
    // authorization cookie. Its homepage shows whichever Telegram
    // account is currently authorized and has a Log out button.
    window.open("https://oauth.telegram.org/", "_blank", "noopener");
    setStage("prompted");
  };

  const onReload = () => {
    // Full page reload so the widget iframe re-initializes against
    // Telegram's updated cookie state.
    window.location.reload();
  };

  if (stage === "prompted") {
    return (
      <div className="space-y-2">
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90 leading-relaxed">
          A new tab opened on <b>oauth.telegram.org</b>. Click{" "}
          <b>Log out</b> there, then come back and hit the button
          below.
        </div>
        <Button
          onClick={onReload}
          variant="outline"
          size="sm"
          className="w-full"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          I logged out — reload widget
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={onOpenLogout}
      variant="outline"
      size="sm"
      className="w-full"
    >
      <LogOut className="h-3.5 w-3.5" />
      Use a different Telegram account
    </Button>
  );
}
