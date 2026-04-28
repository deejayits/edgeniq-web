"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// 30-day trade-count area chart for a single target. Recharts handles
// responsive sizing; we pass colors via the theme vars so dark-mode
// looks right without a theme toggle.

type Point = {
  date: string;   // YYYY-MM-DD
  buys: number;
  sells: number;
  /** Positions with side='other' — 13F holdings snapshots. Plotted as
   *  a single area since a 13F doesn't tell us buy vs sell directly. */
  positions: number;
  total: number;
};

type Props = {
  trades: Array<{
    trade_date: string;
    side: "buy" | "sell" | "exchange" | "other";
  }>;
  height?: number;
};

export function ActivityChart({ trades, height = 200 }: Props) {
  const data: Point[] = useMemo(() => {
    // Bucket trades by calendar day for the last 90 days. 13F filings
    // are quarterly with a 45-day lag, so 90 days captures a full
    // quarter of activity. Three separate series:
    //   buys / sells — directional trades (insiders, activists)
    //   positions     — 'other'-side entries (13F holdings snapshots)
    //   total         — sum of everything, used as the baseline line
    //                   so funds with only 'other' trades still show
    //                   a visible spike on their filing date.
    const buckets = new Map<string, Point>();
    const end = new Date();
    for (let i = 89; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      buckets.set(key, {
        date: key,
        buys: 0,
        sells: 0,
        positions: 0,
        total: 0,
      });
    }
    for (const t of trades) {
      const b = buckets.get(t.trade_date);
      if (!b) continue;
      if (t.side === "buy") b.buys++;
      else if (t.side === "sell") b.sells++;
      else b.positions++;
      b.total++;
    }
    return [...buckets.values()];
  }, [trades]);

  // Detect whether we have directional (buy/sell) data OR only 13F
  // snapshots (positions). Changes which series render — showing a
  // flat zero line for buys/sells on a 13F-only target looks broken.
  const hasDirectional = useMemo(
    () => data.some((d) => d.buys > 0 || d.sells > 0),
    [data],
  );
  const hasPositions = useMemo(
    () => data.some((d) => d.positions > 0),
    [data],
  );

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <AreaChart
          data={data}
          margin={{ top: 10, right: 12, left: -12, bottom: 0 }}
        >
          <defs>
            <linearGradient id="buys-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="sells-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fb7185" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#fb7185" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="positions-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgb(39,39,42)"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tickFormatter={(v) => v.slice(5)}
            tick={{ fill: "rgb(161,161,170)", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            minTickGap={40}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "rgb(161,161,170)", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={24}
          />
          <Tooltip
            contentStyle={{
              background: "rgb(24,24,27)",
              border: "1px solid rgb(63,63,70)",
              borderRadius: 8,
              fontSize: 12,
            }}
            cursor={{ stroke: "rgb(63,63,70)", strokeWidth: 1 }}
            labelFormatter={(v) => v}
          />
          {hasDirectional && (
            <>
              <Area
                type="monotone"
                dataKey="buys"
                name="Buys"
                stroke="#34d399"
                strokeWidth={2}
                fill="url(#buys-gradient)"
              />
              <Area
                type="monotone"
                dataKey="sells"
                name="Sells"
                stroke="#fb7185"
                strokeWidth={2}
                fill="url(#sells-gradient)"
              />
            </>
          )}
          {hasPositions && (
            <Area
              type="monotone"
              dataKey="positions"
              name="Positions disclosed"
              stroke="#a78bfa"
              strokeWidth={2}
              fill="url(#positions-gradient)"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
