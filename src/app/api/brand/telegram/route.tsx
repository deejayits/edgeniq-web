import { ImageResponse } from "next/og";

// 512×512 Telegram bot profile picture. Vertical stack: icon on top,
// "EdgeNiq" wordmark below. Opaque gradient background (Telegram rejects
// transparency — it would fill with black otherwise).
//
// User downloads this from /brand and uploads to @BotFather via
// /setuserpic.

export const runtime = "nodejs";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #34d399 0%, #a78bfa 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 60,
        }}
      >
        {/* Visual icon — uptrend on a subtly-lighter badge so it reads on
            top of the gradient without being harsh */}
        <svg
          width={240}
          height={240}
          viewBox="0 0 100 100"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            x="0"
            y="0"
            width="100"
            height="100"
            rx="22"
            ry="22"
            fill="rgba(255,255,255,0.14)"
          />
          <path
            d="M22 74 L22 62 L42 62 L42 46 L62 46 L62 30 L82 30"
            stroke="white"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <circle cx="82" cy="30" r="7" fill="white" />
        </svg>
        {/* Full wordmark, all one color (white) at this scale — the
            two-tone Edge/Niq split is reserved for the website where
            there's a dark background to contrast against. */}
        <div
          style={{
            display: "flex",
            color: "white",
            fontSize: 76,
            fontWeight: 700,
            letterSpacing: -2,
          }}
        >
          EdgeNiq
        </div>
      </div>
    ),
    {
      width: 512,
      height: 512,
      headers: {
        "Content-Disposition": 'inline; filename="edgeniq-telegram-512.png"',
      },
    },
  );
}
