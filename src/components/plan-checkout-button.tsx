"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Plan CTA — when billing is live, POSTs to /api/stripe/checkout and
// redirects to Stripe. When billing is off, the API returns 503 and
// we surface a "contact admin" toast instead of a scary error. Shared
// between the Pro and Elite pricing tiers so both CTAs behave the same.
export function PlanCheckoutButton({
  plan,
  label,
  variant = "default",
}: {
  plan: "pro" | "elite";
  label: string;
  variant?: "default" | "outline";
}) {
  const [loading, setLoading] = useState(false);

  const onClick = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (res.status === 401) {
        // Not logged in — send them to login with a redirect back.
        window.location.href = `/login?next=${encodeURIComponent(
          `/app?upgrade=${plan}`,
        )}`;
        return;
      }
      if (res.status === 503) {
        // Billing not wired yet — route through the trial signup flow.
        toast.info(
          "Billing is coming soon. Start your free 7-day trial on Telegram; contact the admin to activate Pro or Elite after the trial.",
        );
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) {
        toast.error(data?.message ?? "Checkout failed. Try again.");
        return;
      }
      window.location.href = data.url;
    } catch (exc) {
      toast.error(exc instanceof Error ? exc.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={onClick}
      variant={variant}
      className="w-full"
      disabled={loading}
    >
      {loading ? "…" : label}
    </Button>
  );
}
