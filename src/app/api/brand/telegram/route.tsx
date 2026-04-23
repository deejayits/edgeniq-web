import { ImageResponse } from "next/og";

// 512×512 PNG ready for Telegram bot profile picture.
// User visits /api/brand/telegram and saves the image (right-click → Save).
// Telegram requires 512×512 PNG or JPG with no alpha transparency — this
// response is fully opaque because the gradient fills every pixel.

export const runtime = "nodejs";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(135deg, #34d399 0%, #a78bfa 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: 220,
          fontWeight: 700,
          letterSpacing: -5,
          position: "relative",
        }}
      >
        <span style={{ position: "relative", zIndex: 1 }}>EN</span>
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
