import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrandLockup } from "@/components/brand";
import { LogoIcon } from "@/components/logo-icon";
import { ArrowLeft, Download } from "lucide-react";

export const metadata = {
  title: "Brand assets — EdgeNiq",
  description: "Logo, icon, and color tokens for the EdgeNiq brand.",
};

export default function BrandPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-border/50">
        <div className="mx-auto max-w-5xl px-6 h-16 flex items-center">
          <Link href="/" aria-label="EdgeNiq home">
            <BrandLockup iconSize={30} textClassName="text-lg" />
          </Link>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-5xl px-6 py-16 w-full">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>

        <h1 className="text-4xl font-semibold tracking-tight mb-3">
          Brand assets
        </h1>
        <p className="text-muted-foreground max-w-xl mb-12">
          Logo, icon, and colors. Use these on social, press, and —
          most importantly — as the Telegram bot&rsquo;s profile photo.
        </p>

        {/* Icon — the primary asset */}
        <section className="mb-12">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Icon
          </h2>
          <Card className="p-8 border-border/60 bg-card/50">
            <div className="grid md:grid-cols-[auto_1fr] gap-8 items-center">
              <div className="flex items-center justify-center">
                <LogoIcon size={256} />
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">
                  Telegram profile picture
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  512×512 PNG. Opaque — Telegram crops to a circle but
                  won&rsquo;t show transparency. Right-click the button
                  and <em>Save image as…</em> or just download and drop
                  it into @BotFather.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button asChild size="sm">
                    <a
                      href="/api/brand/telegram"
                      download="edgeniq-telegram-512.png"
                    >
                      <Download className="h-4 w-4" />
                      Download 512×512 PNG
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <a href="/api/brand/telegram" target="_blank" rel="noreferrer">
                      Open in new tab
                    </a>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  In @BotFather: <code className="font-mono">/setuserpic</code> →
                  pick <code className="font-mono">@edgeniq_alerts_bot</code> →
                  upload the file.
                </p>
              </div>
            </div>
          </Card>
        </section>

        {/* Size preview */}
        <section className="mb-12">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Icon at every size
          </h2>
          <Card className="p-8 border-border/60 bg-card/50">
            <div className="flex items-end gap-8 flex-wrap">
              {[16, 24, 32, 48, 64, 96, 128].map((s) => (
                <div key={s} className="flex flex-col items-center gap-2">
                  <LogoIcon size={s} />
                  <span className="text-xs font-mono text-muted-foreground">
                    {s}px
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </section>

        {/* Lockup */}
        <section className="mb-12">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Logo lockup
          </h2>
          <Card className="p-8 border-border/60 bg-card/50">
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <BrandLockup iconSize={48} textClassName="text-3xl" />
                <span className="text-xs font-mono text-muted-foreground">
                  3xl
                </span>
              </div>
              <div className="flex items-center gap-4">
                <BrandLockup iconSize={32} textClassName="text-xl" />
                <span className="text-xs font-mono text-muted-foreground">
                  xl
                </span>
              </div>
              <div className="flex items-center gap-4">
                <BrandLockup iconSize={24} textClassName="text-base" />
                <span className="text-xs font-mono text-muted-foreground">
                  base
                </span>
              </div>
            </div>
          </Card>
        </section>

        {/* Colors */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Colors
          </h2>
          <Card className="p-8 border-border/60 bg-card/50">
            <div className="grid sm:grid-cols-2 gap-6">
              <ColorSwatch
                label="Edge / Emerald"
                hex="#34d399"
                note="tailwind emerald-400"
              />
              <ColorSwatch
                label="Niq / Violet"
                hex="#a78bfa"
                note="tailwind violet-400"
              />
            </div>
          </Card>
        </section>
      </main>
    </div>
  );
}

function ColorSwatch({
  label,
  hex,
  note,
}: {
  label: string;
  hex: string;
  note: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <div
        className="h-14 w-14 rounded-md border border-border/60 shadow-inner"
        style={{ backgroundColor: hex }}
      />
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground font-mono">{hex}</div>
        <div className="text-xs text-muted-foreground">{note}</div>
      </div>
    </div>
  );
}
