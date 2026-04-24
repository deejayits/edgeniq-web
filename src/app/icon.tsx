import { ImageResponse } from "next/og";

// Favicon — just the visual icon (uptrend line on gradient square).
// No letters; at 64px a monogram would read as noise.

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #34d399 0%, #a78bfa 100%)",
          borderRadius: 14,
          display: "flex",
          position: "relative",
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M22 74 L22 62 L42 62 L42 46 L62 46 L62 30 L82 30"
            stroke="white"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <circle cx="82" cy="30" r="6" fill="white" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
