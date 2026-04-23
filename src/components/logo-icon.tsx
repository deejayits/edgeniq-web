// EdgeNiq logo mark — scalable SVG. Used at all sizes from 16px favicon
// to 512px Telegram profile pic.
//
// Composition:
//   - Rounded square (20% radius) for a modern badge look
//   - Emerald → violet diagonal gradient (the brand's two-tone story)
//   - Faint uptrend chart line behind the monogram (the trading edge)
//   - Bold "EN" monogram in white
//
// viewBox is 100×100; pass any size via the `size` prop (or className).
export function LogoIcon({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      aria-label="EdgeNiq"
      role="img"
    >
      <defs>
        <linearGradient id="edgeniq-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
      <rect
        x="0"
        y="0"
        width="100"
        height="100"
        rx="20"
        ry="20"
        fill="url(#edgeniq-bg)"
      />
      {/* Faint uptrend line — the "edge" — sits behind the monogram */}
      <path
        d="M15,72 L34,55 L52,64 L86,28"
        stroke="white"
        strokeOpacity="0.22"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <text
        x="50"
        y="68"
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fontSize="44"
        fontWeight="700"
        fill="white"
        letterSpacing="-1"
      >
        EN
      </text>
    </svg>
  );
}
