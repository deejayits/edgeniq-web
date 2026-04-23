import { ImageResponse } from "next/og";

// Apple touch icon for iOS home-screen pinning.

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(135deg, #34d399 0%, #a78bfa 100%)",
          borderRadius: 38,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: 78,
          fontWeight: 700,
          letterSpacing: -2,
        }}
      >
        EN
      </div>
    ),
    { ...size },
  );
}
