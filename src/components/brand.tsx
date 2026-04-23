// Brand wordmark. Two halves, two colors:
//   Edge (emerald) — the trader's edge, gains, forward momentum
//   Niq  (violet)  — unique analysis, premium, the twist that covers
//                    the edge cases other scanners miss
// Tooltip carries the origin story for anyone curious.
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
