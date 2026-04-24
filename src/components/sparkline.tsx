// Tiny inline SVG sparkline. Single-color stroke, optional filled area.
// Drawn to fit the container — width/height are CSS-driven, SVG uses
// a viewBox so it scales cleanly.
//
// Values are expected in chronological order (oldest first). If all
// values are equal (or empty), renders a flat line to avoid NaN in the
// path math.
export function Sparkline({
  values,
  stroke = "currentColor",
  fill = "currentColor",
  fillOpacity = 0.08,
  strokeWidth = 1.5,
  width = 120,
  height = 32,
  showArea = true,
  className,
}: {
  values: number[];
  stroke?: string;
  fill?: string;
  fillOpacity?: number;
  strokeWidth?: number;
  width?: number;
  height?: number;
  showArea?: boolean;
  className?: string;
}) {
  if (!values.length) {
    values = [0, 0];
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = values.length > 1 ? 100 / (values.length - 1) : 0;
  const y = (v: number) => {
    // Invert because SVG y grows downward.
    return 100 - ((v - min) / range) * 100;
  };
  const pts = values.map((v, i) => `${(i * step).toFixed(2)},${y(v).toFixed(2)}`);
  const linePath = `M ${pts.join(" L ")}`;
  const areaPath = `${linePath} L 100,100 L 0,100 Z`;

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      width={width}
      height={height}
      className={className}
      aria-hidden
    >
      {showArea && (
        <path d={areaPath} fill={fill} fillOpacity={fillOpacity} stroke="none" />
      )}
      <path
        d={linePath}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
