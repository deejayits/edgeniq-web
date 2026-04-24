import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Force apex edgeniq.com → www.edgeniq.com. Matters because Telegram
  // Login Widget refuses to auth on any origin that doesn't exactly
  // match the domain registered via @BotFather (we register www) —
  // users who typed `edgeniq.com` on mobile were getting "Bot domain
  // invalid". This server-level 308 happens before any page renders so
  // the widget always loads on the canonical www host.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "edgeniq.com" }],
        destination: "https://www.edgeniq.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
