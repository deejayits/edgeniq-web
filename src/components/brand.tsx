import { LogoIcon } from "./logo-icon";

// Brand wordmark.
//   Edge (emerald) — the trader's edge, gains, forward momentum
//   Niq  (violet)  — unique analysis, the twist that covers edge cases
// Tooltip carries the origin story.
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

// Icon + wordmark lockup. Preferred for headers because the glyph is
// distinctive and the wordmark stays legible. `size` controls the
// icon height; wordmark scales with text classes.
export function BrandLockup({
  iconSize = 32,
  textClassName = "text-lg",
  gap = "gap-2.5",
  title,
}: {
  iconSize?: number;
  textClassName?: string;
  gap?: string;
  title?: string;
}) {
  return (
    <span className={`inline-flex items-center ${gap}`}>
      <LogoIcon size={iconSize} className="shrink-0" />
      <BrandMark className={textClassName} title={title} />
    </span>
  );
}
