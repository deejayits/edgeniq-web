# edgeniq-web

Marketing site + user dashboard for [EdgeNiq](https://www.edgeniq.com).
Next.js 16 App Router on Vercel, Supabase as the shared data layer with
the Python Telegram bot, Auth.js v5 for Telegram Login.

Sister repo: [deejayits/edgeniq](https://github.com/deejayits/edgeniq)
(the Python bot that actually fires signals).

## Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 16 (App Router, RSC, proxy.ts) |
| Styling | Tailwind 4 + shadcn/ui (radix-nova style, dark default) |
| Auth | Auth.js v5 (custom Telegram Login provider) |
| DB | Supabase Postgres (shared with bot, RLS + service_role split) |
| Fonts | Geist Sans + Geist Mono via `next/font` |
| Env validation | `@t3-oss/env-nextjs` + Zod |
| Hosting | Vercel |

## Local dev

```bash
npm install
cp .env.example .env.local
# fill in values from Supabase dashboard + bot's .env
npm run dev
```

Visit http://localhost:3000. Telegram Login Widget only works over
HTTPS — the login page shows a dev-mode hint locally. To test sign-in
end-to-end, deploy to a Vercel preview URL.

## Project layout

```
src/
├── app/
│   ├── page.tsx                   # marketing landing at /
│   ├── login/                     # /login — Telegram Login Widget
│   ├── legal/{terms,privacy}/     # legal stubs
│   ├── app/                       # /app/* — protected dashboard
│   │   ├── layout.tsx             # shell + nav + user menu
│   │   ├── page.tsx               # dashboard home ("Today")
│   │   ├── portfolio/             # active + closed personal trades
│   │   ├── history/               # resolved signals + win rate
│   │   └── settings/              # account + preferences (read-only)
│   └── api/auth/                  # Auth.js routes
├── components/
│   ├── ui/                        # shadcn components
│   ├── app-nav.tsx                # dashboard top-nav
│   ├── user-menu.tsx              # avatar dropdown
│   └── telegram-login-button.tsx  # Widget injector
├── lib/
│   ├── supabase/server.ts         # service-role client
│   ├── telegram-auth.ts           # HMAC-SHA256 verifier
│   └── utils.ts                   # cn()
├── auth.ts                        # Auth.js v5 config
├── env.ts                         # typed env with Zod
└── proxy.ts                       # Next.js 16 proxy (was middleware.ts)
```

## How auth works

1. User hits `/login`, clicks "Log in with Telegram" Widget button.
2. Telegram OAuth redirects to `/api/auth/telegram/callback` with a
   signed payload.
3. Callback route calls Auth.js `signIn("telegram", params)`.
4. `authorize()` in `src/auth.ts` verifies the HMAC hash using
   `TELEGRAM_BOT_TOKEN`, then looks up the user in Supabase via
   `chat_id = tg.id`.
5. If the user doesn't exist (they haven't /start'd the bot yet) or is
   soft-deleted, sign-in refuses.
6. Auth.js issues a JWT with `tgUserId`, `role`, `subPlan` claims.
7. `proxy.ts` gates `/app/**` by checking `req.auth`.

## Branching

- `main` — production, auto-deployed to Vercel.
- `develop` — staging, auto-deployed to Vercel preview.
- Feature branches → PR → develop → main.

## Deploy

1. `vercel link` (first time only).
2. Vercel project settings → Environment Variables — paste the vars
   from `.env.example`.
3. `vercel --prod` or push to `main`.

## License

Proprietary. All rights reserved.
