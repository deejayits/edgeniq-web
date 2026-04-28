import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { env } from "@/env";
import { verifyTelegramAuth } from "@/lib/telegram-auth";
import { supabaseAdmin } from "@/lib/supabase/server";

// Auth.js v5 (JWT strategy — no DB sessions table).
//
// Sign-in flow:
//   1. User clicks Telegram Login button → Telegram OAuth → payload
//      redirected to /api/auth/telegram/callback
//   2. Callback route calls signIn("telegram", payload) with the
//      verified payload fields as credentials
//   3. authorize() below re-verifies the hash (defense-in-depth) and
//      upserts / links the user in Supabase
//   4. Auth.js issues a session JWT with tgUserId + role claims
//
// COOKIE SCOPE — operational note:
// Auth.js scopes its session cookie via the request URL Auth handles.
// On Vercel preview deploys (preview-edgeniq-foo.vercel.app) the
// preview domain mints its own cookies, separate from production
// cookies on www.edgeniq.com. That's correct.
// What to verify in the Vercel project settings:
//   - Production env: NEXTAUTH_URL (or AUTH_URL) = https://www.edgeniq.com
//   - Preview env: NEXTAUTH_URL = unset (Auth.js auto-detects per
//     deploy URL) OR set to a preview-specific value
// If a previous deploy hardcoded NEXTAUTH_URL=production-URL into
// the preview env, preview deploys would mint cookies for the prod
// domain — leakage risk. Audit at:
//   vercel.com/<team>/<project>/settings/environment-variables
export const {
  handlers,
  signIn,
  signOut,
  auth,
} = NextAuth({
  secret: env.AUTH_SECRET,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      id: "telegram",
      name: "Telegram",
      credentials: {
        id: {},
        first_name: {},
        last_name: {},
        username: {},
        photo_url: {},
        auth_date: {},
        hash: {},
      },
      async authorize(raw) {
        // Strict allowlist — Auth.js signIn() sometimes leaks redirect /
        // redirectTo / csrfToken into the credentials, which would
        // pollute the HMAC data-check-string and break hash verification.
        const TG_FIELDS = [
          "id",
          "first_name",
          "last_name",
          "username",
          "photo_url",
          "auth_date",
          "hash",
        ] as const;
        const payload: Record<string, string> = {};
        for (const k of TG_FIELDS) {
          const v = (raw as Record<string, unknown> | null)?.[k];
          if (typeof v === "string" && v.length > 0) payload[k] = v;
        }
        const verified = verifyTelegramAuth(payload, env.TELEGRAM_BOT_TOKEN);
        if (!verified.ok) {
          console.warn(
            "[auth] Telegram payload rejected:",
            verified.reason,
            "payload keys:",
            Object.keys(payload).join(","),
          );
          return null;
        }
        const tg = verified.data;
        const tgUserId = tg.id;

        // Upsert into Supabase so the web-only profile fields (web_email,
        // last_seen_at) stay fresh. Role is read from the existing row —
        // we never elevate role here. If this user has never interacted
        // with the Telegram bot, the row won't exist yet; we refuse
        // login in that case (user must /start the bot first).
        const db = supabaseAdmin();
        const { data: existing } = await db
          .from("users")
          .select(
            "chat_id, username, name, role, sub_plan, sub_status, deleted",
          )
          .eq("chat_id", tgUserId)
          .maybeSingle();

        if (!existing) {
          console.warn(
            `[auth] no bot account for tg_user_id=${tgUserId}; refusing web login`,
          );
          return null;
        }
        if (existing.deleted) {
          console.warn(
            `[auth] soft-deleted account tg_user_id=${tgUserId}; refusing login`,
          );
          return null;
        }

        // Refresh last_seen_at + store username so /admins shows who
        // logged in via web. Use the display username already on file
        // if the Telegram one is missing (admins have cosmetic names).
        await db
          .from("users")
          .update({
            last_seen_at: new Date().toISOString(),
            username:
              existing.username ||
              tg.username ||
              `${tg.first_name ?? ""}${tg.last_name ? " " + tg.last_name : ""}`.trim(),
          })
          .eq("chat_id", tgUserId);

        return {
          id: String(tgUserId),
          name:
            existing.username ||
            tg.username ||
            `${tg.first_name ?? ""}${tg.last_name ? " " + tg.last_name : ""}`.trim(),
          image: tg.photo_url,
          // Propagated into the JWT in the jwt() callback below.
          tgUserId,
          role: existing.role,
          subPlan: existing.sub_plan,
          subStatus: existing.sub_status,
        } as never;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // user is only present on initial sign-in. Persist the claims
      // we care about onto the token so they survive session reads.
      if (user) {
        const u = user as unknown as {
          tgUserId: number;
          role: string;
          subPlan: string;
          subStatus: string;
        };
        token.tgUserId = u.tgUserId;
        token.role = u.role;
        token.subPlan = u.subPlan;
        token.subStatus = u.subStatus;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { tgUserId?: number }).tgUserId =
          token.tgUserId as number;
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { subPlan?: string }).subPlan =
          token.subPlan as string;
        (session.user as { subStatus?: string }).subStatus =
          token.subStatus as string;
      }
      return session;
    },
  },
});
