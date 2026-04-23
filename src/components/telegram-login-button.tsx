"use client";

import { useEffect, useRef, useState } from "react";
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
// The domain also has to be whitelisted via @BotFather → /setdomain.
// If that's missing, the widget quietly no-ops (no iframe appears),
// which is why we time-out and render a helpful hint after 3s.
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
  const [status, setStatus] = useState<"loading" | "ready" | "failed">(
    "loading",
  );
  const [isLocalhost, setIsLocalhost] = useState(false);

  useEffect(() => {
    setIsLocalhost(window.location.hostname === "localhost");
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Telegram rejects localhost — only HTTPS origins work.
    if (window.location.hostname === "localhost") return;

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

    // Telegram injects an <iframe> inside the container on successful
    // load. If nothing appears after 3s, assume the domain isn't
    // whitelisted with BotFather and show the helpful hint.
    const timer = setTimeout(() => {
      const iframe = container.querySelector("iframe");
      setStatus(iframe ? "ready" : "failed");
    }, 3000);

    return () => {
      clearTimeout(timer);
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    };
  }, [botUsername, next]);

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div ref={containerRef} />

      <noscript>
        <p className="text-sm text-muted-foreground">
          JavaScript is required to sign in with Telegram.
        </p>
      </noscript>

      {isLocalhost && (
        <div className="rounded-md border border-border/60 bg-muted/30 px-4 py-3 text-xs text-muted-foreground max-w-sm text-center">
          Telegram Login Widget only works over HTTPS. Deploy to a
          preview URL (or use ngrok) to test sign-in locally.
        </div>
      )}

      {!isLocalhost && status === "failed" && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-200/90 max-w-md">
          <p className="font-medium mb-1">
            Widget didn&rsquo;t load.
          </p>
          <p className="leading-relaxed">
            Most common cause: <code>@{botUsername}</code>&rsquo;s
            login domain isn&rsquo;t set. Message{" "}
            <a
              href="https://t.me/BotFather"
              className="underline hover:no-underline"
              target="_blank"
              rel="noreferrer"
            >
              @BotFather
            </a>
            , send <code>/setdomain</code>, pick the bot, then send{" "}
            <code>{typeof window !== "undefined" ? window.location.hostname : "www.edgeniq.com"}</code>.
            Then refresh.
          </p>
        </div>
      )}
    </div>
  );
}
