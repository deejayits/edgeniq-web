"use client";

import { useMemo } from "react";
import {
  Line,
  LineChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Side-by-side activity lines — one per compared target. Each line
// traces daily trade count over the last 30 days. The y-axis is
// cumulative trade count so you can see "who's been most active" at
// a glance without eyeballing spiky bar charts.

const SERIES_COLORS = [
  "#34d399", // emerald — first series
  "#a78bfa", // violet — second series
  "#fbbf24", // amber — third series
];

type TradeLite = {
  target_id: string;
  trade_date: string;
};

type Target = {
  id: string;
  display_name: string;
};

export function CompareChart({
  targets,
  trades,
  height = 260,
}: {
  targets: Target[];
  trades: TradeLite[];
  height?: number;
}) {
  const data = useMemo(() => {
    // Bucket per target per day, then compute cumulative running totals
    // so the chart shows who has more trade activity over the window.
    const dates: string[] = [];
    const end = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }
    // Map target_id -> { date -> count }
    const counts = new Map<string, Map<string, number>>();
    for (const t of targets) counts.set(t.id, new Map());
    for (const tr of trades) {
      const bucket = counts.get(tr.target_id);
      if (!bucket) continue;
      bucket.set(tr.trade_date, (bucket.get(tr.trade_date) ?? 0) + 1);
    }
    // Cumulative per target.
    const running = new Map<string, number>();
    for (const t of targets) running.set(t.id, 0);
    return dates.map((date) => {
      const row: Record<string, number | string> = { date };
      for (const t of targets) {
        const added = counts.get(t.id)?.get(date) ?? 0;
        const prev = running.get(t.id) ?? 0;
        const next = prev + added;
        running.set(t.id, next);
        row[t.id] = next;
      }
      return row;
    });
  }, [targets, trades]);

  if (targets.length === 0) return null;

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <LineChart
          data={data}
          margin={{ top: 10, right: 12, left: -12, bottom: 0 }}
        >
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
          />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            iconType="circle"
            iconSize={8}
          />
          {targets.map((t, i) => (
            <Line
              key={t.id}
              type="monotone"
              dataKey={t.id}
              name={t.display_name}
              stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
