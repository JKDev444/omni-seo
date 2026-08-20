"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface TrendPoint {
  date: string;
  clicks: number;
  impressions: number;
  sessions: number;
  users: number;
}

export function AnalyticsTrendChart({ trend }: { trend: TrendPoint[] }) {
  return (
    <div style={{ width: "100%", height: 280 }}>
      <ResponsiveContainer>
        <LineChart data={trend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--color-ink-faint)" }} />
          <YAxis tick={{ fontSize: 11, fill: "var(--color-ink-faint)" }} />
          <Tooltip
            contentStyle={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              fontSize: "var(--text-sm)",
            }}
          />
          <Legend wrapperStyle={{ fontSize: "var(--text-xs)" }} />
          <Line type="monotone" dataKey="sessions" name="Sessions (GA4)" stroke="var(--color-accent)" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="clicks" name="Clicks (GSC)" stroke="var(--color-success)" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="impressions" name="Impressions (GSC)" stroke="var(--color-warning)" dot={false} strokeWidth={1.5} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
