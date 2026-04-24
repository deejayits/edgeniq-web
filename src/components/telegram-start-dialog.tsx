"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Smartphone } from "lucide-react";

// Telegram Start dialog — replaces the naive "open t.me/..." external
// link with explicit choices. The bare t.me URL dead-ends for anyone
// without Telegram Desktop installed (the "START BOT" button fires a
// tg:// deep link that no handler catches). This modal gives:
//   1. A QR code for mobile scanning — the most reliable path
//   2. An "Open in Telegram app" button (tg:// protocol)
//   3. A "Download Telegram" link for users who don't have it at all
//
// Using the free public api.qrserver.com QR-code service so we don't
// need to bundle a library just for a single QR.

const BOT_USERNAME = "edgeniq_alerts_bot";
const BOT_LINK = `https://t.me/${BOT_USERNAME}`;
const QR_URL =
  `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(BOT_LINK)}&color=ffffff&bgcolor=111113&qzone=2`;

export function TelegramStartDialog({
  trigger,
}: {
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start on Telegram</DialogTitle>
          <DialogDescription>
            Signup happens inside the bot. Scan the QR below with your
            phone — Telegram opens the bot and you can hit <code>/start</code>.
          </DialogDescription>
        </DialogHeader>

        {/* Scan the QR from any phone — primary and only path. The
            old "On this computer" buttons (tg:// deep link + t.me
            fallback) dead-ended for users without Telegram Desktop
            installed, so we removed them. Mobile-first is the reliable
            path for everyone. */}
        <div className="rounded-lg border border-border/60 bg-card/60 p-5">
          <div className="flex items-start gap-4">
            <div className="h-9 w-9 rounded-md bg-gradient-to-br from-emerald-400/15 to-violet-400/15 border border-border/60 flex items-center justify-center shrink-0">
              <Smartphone className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-sm mb-0.5">
                Scan with your phone
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                Point any camera at the QR. Telegram opens the bot;
                send <code>/start</code> to begin.
              </p>
            </div>
          </div>
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={QR_URL}
              alt={`QR code for ${BOT_LINK}`}
              width={220}
              height={220}
              className="rounded-md border border-border/60 bg-[#111113]"
            />
          </div>
          <p className="text-center text-xs text-muted-foreground mt-3">
            or open{" "}
            <a
              href={BOT_LINK}
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-foreground"
            >
              t.me/{BOT_USERNAME}
            </a>{" "}
            in any browser
          </p>
        </div>

        {/* No Telegram installed yet */}
        <div className="text-center pt-1">
          <a
            href="https://telegram.org/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
          >
            <Download className="h-3 w-3" />
            Don&rsquo;t have Telegram yet? Get it free
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
