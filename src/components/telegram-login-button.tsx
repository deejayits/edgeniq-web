"use client";

import { useEffect, useRef } from "react";
import { env } from "@/env";

// Telegram Login Widget renders an inline iframe that opens Telegram's
// OAuth flow. After the user confirms, Telegram redirects to
// `data-auth-url` with the signed payload in the query string. Our
// callback route verifies the hash and issues an Auth.js session.
//
// Telegram requires the widget script to be injected inside a <script>
// tag with specific data-* attributes — it won't work via React refs /
// imperative DOM. We inject it once on mount and clean up on unmount.
//
// Docs: https://core.telegram.org/widgets/login
export function TelegramLoginButton({
  botUsername,
  next,
}: {
  botUsername: string;
  next?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Telegram rejects localhost — only HTTPS origins work. During local
    // dev we render a dev-mode hint instead of the (broken) widget.
    if (
      typeof window !== "undefined" &&
      window.location.hostname === "localhost"
    ) {
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "10");
    script.setAttribute(
      "data-auth-url",
      `${env.NEXT_PUBLIC_APP_URL}/api/auth/telegram/callback${
        next ? `?next=${encodeURIComponent(next)}` : ""
      }`,
    );
    script.setAttribute("data-request-access", "write");
    container.appendChild(script);

    return () => {
      // Best-effort cleanup; Telegram widget self-injects siblings.
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    };
  }, [botUsername, next]);

  return (
    <>
      <div ref={containerRef} />
      <noscript>
        <p className="text-sm text-muted-foreground">
          JavaScript is required to sign in with Telegram.
        </p>
      </noscript>
      {typeof window !== "undefined" &&
        window.location.hostname === "localhost" && (
          <div className="rounded-md border border-border/60 bg-muted/30 px-4 py-3 text-xs text-muted-foreground max-w-sm text-center">
            Telegram Login Widget only works over HTTPS. Deploy to a
            preview URL (or use ngrok) to test sign-in locally.
          </div>
        )}
    </>
  );
}
