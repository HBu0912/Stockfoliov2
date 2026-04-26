"use client";

import { buildTop5Slices } from "@/lib/allocations";
import type { Holding } from "@/generated/prisma";
import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, Tooltip, ResponsiveContainer } from "recharts";

type H = Pick<Holding, "id" | "symbol" | "name" | "shares" | "lastPrice">;

export function HoldingPie({ holdings, height = 220 }: { holdings: H[]; height?: number }) {
  const { slices, total } = useMemo(() => buildTop5Slices(holdings), [holdings]);
  const [active, setActive] = useState<{ name: string; value: string } | null>(null);

  if (slices.length === 0) {
    return <p className="text-sm text-(--muted)">No value yet — add holdings with live prices to see a chart.</p>;
  }

  const data = slices.map((s) => ({ name: s.label, value: s.value, fill: s.color, pct: s.pct }));
  return (
    <div style={{ minHeight: height + 40 }} className="w-full max-w-sm">
      <p className="text-xs text-(--muted) mb-1">
        Top {slices.length <= 5 ? slices.length : 5} + {slices.some((s) => s.label === "Other") ? "Other" : "holdings"}{" "}
        (hover slices)
        {active && <span className="ml-2 text-foreground font-medium">— {active.name}: {active.value}</span>}
      </p>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as { name: string; value: number; pct: number; fill: string };
              return (
                <div className="rounded-md border border-(--card-border) bg-(--background) px-2 py-1.5 text-sm shadow">
                  <div className="font-medium">{p.name}</div>
                  <div>
                    {p.pct.toFixed(1)}% of this view
                    {total > 0 && (
                      <span className="text-(--muted)"> — ${(p.value as number).toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
                    )}
                  </div>
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
            onMouseEnter={(_, idx) => {
              const d = data[idx];
              if (d)
                setActive({
                  name: d.name,
                  value: `${d.pct.toFixed(1)}% ($${(d as { value: number }).value.toLocaleString("en-US", { maximumFractionDigits: 0 })})`,
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
    </div>
  );
}
