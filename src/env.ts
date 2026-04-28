import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

// Single source of truth for runtime env. Missing or malformed values
// crash the build so they can't hit prod. Never import process.env
// directly from app code — import { env } from "@/env" instead.
export const env = createEnv({
  server: {
    // Supabase
    SUPABASE_URL: z.string().url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),

    // Auth.js v5 — generate with `openssl rand -base64 32`
    AUTH_SECRET: z.string().min(16),

    // Telegram Login Widget uses the same bot token as the Python bot,
    // so server-side hash verification lines up with whichever bot
    // account the user authenticates against.
    TELEGRAM_BOT_TOKEN: z.string().min(20),
    TELEGRAM_BOT_USERNAME: z.string().min(3), // e.g. "EdgeNiqBot"

    // Stripe (placeholder — unset until billing launches)
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),

    // Feature flags
    BILLING_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),

    // Symmetric AES-256-GCM key for encrypting broker API credentials
    // at rest in Supabase. Generate once with:
    //   openssl rand -base64 32
    // Rotating this key requires re-encrypting every stored broker
    // credential — treat as append-only config.
    TRADING_ENCRYPTION_KEY: z
      .string()
      .min(40)
      .refine(
        (v) => {
          try {
            return Buffer.from(v, "base64").length === 32;
          } catch {
            return false;
          }
        },
        { message: "TRADING_ENCRYPTION_KEY must decode to exactly 32 bytes" },
      ),

    // OAuth for Alpaca — scaffolded but requires Alpaca developer app
    // approval before production use. Unset = paste-key flow only.
    ALPACA_OAUTH_CLIENT_ID: z.string().optional(),
    ALPACA_OAUTH_CLIENT_SECRET: z.string().optional(),
    ALPACA_OAUTH_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),

    // Privacy policy version — must match the Python bot's
    // config.PRIVACY_VERSION. When the bot bumps this and gates
    // signal delivery for stale-ack users, the web dashboard reads
    // this same value and shows a banner pointing the user to
    // Telegram to re-accept (acceptance is bot-side authoritative).
    // Default 1.4 matches the bot's current default — bump in the
    // env var on both sides when the policy changes.
    PRIVACY_VERSION: z.string().default("1.4"),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
    NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
    NEXT_PUBLIC_TELEGRAM_BOT_USERNAME: z.string().min(3),
  },
  // Next.js App Router exposes NEXT_PUBLIC_* to the client automatically
  // but server vars must be explicitly passed to createEnv.
  experimental__runtimeEnv: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_TELEGRAM_BOT_USERNAME:
      process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME,
  },
  emptyStringAsUndefined: true,
});
