import { LogoIcon } from "./logo-icon";

// Brand wordmark — Edge (emerald) + Niq (violet). Always the full
// word, never an EN monogram.
export function BrandMark({
  className = "",
  title = "Edge case analysis, uniquely",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <span className={`font-semibold tracking-tight ${className}`} title={title}>
      <span className="text-emerald-400">Edge</span>
      <span className="text-violet-400">Niq</span>
    </span>
  );
}

// Icon + wordmark lockup. Two orientations:
//   - horizontal (default): icon · EdgeNiq (used in nav bars)
//   - vertical: icon stacked over EdgeNiq (used in hero-ish contexts)
export function BrandLockup({
  iconSize = 32,
  textClassName = "text-lg",
  orientation = "horizontal",
  title,
}: {
  iconSize?: number;
  textClassName?: string;
  orientation?: "horizontal" | "vertical";
  title?: string;
}) {
  const isVertical = orientation === "vertical";
  return (
    <span
      className={
        isVertical
          ? "inline-flex flex-col items-center gap-2"
          : "inline-flex items-center gap-2.5"
      }
    >
      <LogoIcon size={iconSize} className="shrink-0" />
      <BrandMark className={textClassName} title={title} />
    </span>
  );
}
