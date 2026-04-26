"use client";

import { buildTop5Slices } from "@/lib/allocations";
import type { Holding } from "@/generated/prisma";
import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, Tooltip, ResponsiveContainer } from "recharts";

type H = Pick<Holding, "id" | "symbol" | "name" | "shares" | "lastPrice">;

export function HoldingPie({ holdings, height = 220 }: { holdings: H[]; height?: number }) {
  const { slices, total } = useMemo(() => buildTop5Slices(holdings), [holdings]);
  const [, setActive] = useState<{ name: string; value: string } | null>(null);

  if (slices.length === 0) {
    return <p className="text-sm text-(--muted)">No value yet — add holdings with live prices to see a chart.</p>;
  }

  const data = slices.map((s) => ({ name: s.label, value: s.value, fill: s.color, pct: s.pct }));
  return (
    <div style={{ minHeight: height + 56 }} className="w-full max-w-none">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as { name: string; value: number; pct: number; fill: string };
              return (
                <div className="rounded-md border border-(--card-border) bg-(--background) px-2 py-1.5 text-sm shadow">
                  <div className="font-medium">{p.name}</div>
                  <div>{p.pct.toFixed(1)}% of account</div>
                </div>
              );
            }}
            trigger="hover"
          />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="42%"
            outerRadius="80%"
            paddingAngle={2}
            animationDuration={350}
            onMouseEnter={(_, idx) => {
              const d = data[idx];
              if (d)
                setActive({
                  name: d.name,
                  value: `${d.pct.toFixed(1)}%`,
                });
            }}
            onMouseLeave={() => setActive(null)}
            stroke="var(--background)"
            strokeWidth={1}
            cornerRadius={4}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={data[i].fill} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        {slices.map((s) => (
          <div key={s.label} className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-(--muted)">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
            <span className="font-medium text-foreground">{s.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
