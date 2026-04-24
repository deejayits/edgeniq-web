import { ImageResponse } from "next/og";

// Apple touch icon — same visual mark as the favicon at 180×180.

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #34d399 0%, #a78bfa 100%)",
          borderRadius: 38,
          display: "flex",
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
