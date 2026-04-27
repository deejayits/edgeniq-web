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
  // Security headers. Defense-in-depth — Vercel terminates HTTPS so
  // HSTS keeps the user on HTTPS, X-Content-Type-Options stops MIME
  // sniffing, X-Frame-Options blocks click-jacking via iframe, and
  // Referrer-Policy strips full URL leaks to upstream. CSP is left
  // intentionally loose for now (the Telegram Login Widget pulls
  // from oauth.telegram.org and inline-evals its widget; tightening
  // CSP needs a coordinated allow-list per third-party we embed).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
