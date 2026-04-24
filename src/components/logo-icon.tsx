// EdgeNiq logo icon — pure visual mark, no letters.
//
// Composition:
//   - Rounded square with emerald→violet diagonal gradient
//   - Stylized uptrend chart: 3-step staircase rising from bottom-left
//     to top-right, with a signal dot at the endpoint
//   - White strokes for contrast at any size
//
// Designed to read clearly from 16px (favicon) to 512px (Telegram
// profile). No text baked in — pair with the "EdgeNiq" wordmark.
export function LogoIcon({
  size = 32,
  className,
  idSuffix = "",
}: {
  size?: number;
  className?: string;
  // When the icon appears twice on the same page the gradient def id
  // collides. Callers that render multiple instances can pass a unique
  // suffix. Default is "" (single instance).
  idSuffix?: string;
}) {
  const gradId = `edgeniq-grad${idSuffix}`;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      aria-label="EdgeNiq logo"
      role="img"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
      {/* Rounded badge */}
      <rect
        x="0"
        y="0"
        width="100"
        height="100"
        rx="22"
        ry="22"
        fill={`url(#${gradId})`}
      />
      {/* Stepped uptrend — the "edge" */}
      <path
        d="M22 74 L22 62 L42 62 L42 46 L62 46 L62 30 L82 30"
        stroke="white"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Signal dot at the endpoint */}
      <circle cx="82" cy="30" r="5.5" fill="white" />
    </svg>
  );
}
