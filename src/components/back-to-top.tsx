"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

// Floating "back to top" button. Fades in after the user has scrolled
// past SHOW_AFTER pixels. Mobile-first (positioned bottom-right with
// safe-area padding) but visible on desktop too — subtle enough that
// it doesn't distract.
const SHOW_AFTER = 400;

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`fixed bottom-6 right-6 z-50 h-11 w-11 rounded-full border border-border/70 bg-background/80 backdrop-blur-sm text-foreground shadow-lg hover:bg-card hover:scale-105 active:scale-95 transition-all flex items-center justify-center ${
        visible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-4 pointer-events-none"
      }`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ArrowUp className="h-4 w-4" />
    </button>
  );
}
