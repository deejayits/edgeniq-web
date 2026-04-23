import { ImageResponse } from "next/og";

// Auto-generated favicon/icon. Next.js renders this as /icon on request
// and auto-wires it into <link rel="icon"> for every page.
// See https://nextjs.org/docs/app/api-reference/file-conventions/metadata/app-icons

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(135deg, #34d399 0%, #a78bfa 100%)",
          borderRadius: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: -1,
        }}
      >
        EN
      </div>
    ),
    { ...size },
  );
}
