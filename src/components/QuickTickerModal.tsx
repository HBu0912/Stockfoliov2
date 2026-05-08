"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber, formatUsd } from "@/lib/money";

const INTERVALS = ["1D", "1W", "1M", "3M", "1Y", "YTD", "5Y", "ALL"] as const;
type Interval = (typeof INTERVALS)[number];

type ChartRow = { at: string; close: number; idx: number };

type Props = {
  symbol: string;
  name: string | null;
  onClose: () => void;
};

function HudCorner({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const base = "absolute w-4 h-4 border-cyan-500/70";
  const corners = {
    tl: "top-0 left-0 border-t-2 border-l-2",
    tr: "top-0 right-0 border-t-2 border-r-2",
    bl: "bottom-0 left-0 border-b-2 border-l-2",
    br: "bottom-0 right-0 border-b-2 border-r-2",
  };
  return <div className={`${base} ${corners[pos]}`} />;
}

export function QuickTickerModal({ symbol, name, onClose }: Props) {
  const [interval, setInterval] = useState<Interval>("1D");
  const [rows, setRows] = useState<ChartRow[]>([]);
  const [price, setPrice] = useState<number | null>(null);
  const [changePct, setChangePct] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/stocks/${encodeURIComponent(symbol)}?interval=${interval}`);
        if (!res.ok || cancelled) return;
        const d = (await res.json()) as {
          chart?: Array<{ at: string; close: number }>;
          changePct?: number | null;
          metrics?: { price?: number | null };
        };
        if (cancelled) return;
        setRows((d.chart ?? []).map((r, i) => ({ at: r.at, close: r.close, idx: i })));
        setChangePct(d.changePct ?? null);
        setPrice(d.metrics?.price ?? null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [symbol, interval]);

  const up = changePct !== null ? changePct >= 0 : null;
  const neonLine = up === false ? "#f87171" : "#22d3ee";
  const neonGlow = up === false ? "rgba(248,113,113,0.25)" : "rgba(34,211,238,0.25)";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/85 backdrop-blur-sm p-0 pb-[env(safe-area-inset-bottom)] sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-t-xl sm:rounded-xl"
        style={{
          background: "linear-gradient(160deg, #020810 0%, #050d1a 60%, #080514 100%)",
          border: "1px solid rgba(6,182,212,0.35)",
          boxShadow: `0 0 0 1px rgba(6,182,212,0.08), 0 0 60px ${neonGlow}, 0 25px 60px rgba(0,0,0,0.8)`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scanline overlay */}
        <div
          className="pointer-events-none absolute inset-0 z-10 opacity-[0.035]"
          style={{
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.8) 2px, rgba(255,255,255,0.8) 3px)",
          }}
        />

        {/* Top accent bar */}
        <div className="h-px w-full" style={{ background: "linear-gradient(90deg, transparent, rgba(6,182,212,0.9) 30%, rgba(167,139,250,0.9) 70%, transparent)" }} />

        {/* Header */}
        <div className="relative flex items-center justify-between gap-3 px-4 py-3" style={{ borderBottom: "1px solid rgba(6,182,212,0.15)" }}>
          {/* HUD corners on header area */}
          <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-cyan-500/60" />
          <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-cyan-500/60" />

          <div className="min-w-0 pl-2">
            <p className="font-mono text-[9px] tracking-[0.25em] text-cyan-500/50 uppercase">[ MARKET · LIVE ]</p>
            <p className="font-mono text-2xl font-bold tracking-wider" style={{ color: "#22d3ee", textShadow: "0 0 12px rgba(34,211,238,0.5)" }}>
              {symbol}
            </p>
            {name && <p className="truncate font-mono text-[11px] text-slate-400/70">{name}</p>}
          </div>

          <div className="flex shrink-0 items-center gap-4 pr-2">
            {price !== null && (
              <div className="text-right">
                <p className="font-mono text-lg font-bold text-white tabular-nums" style={{ textShadow: "0 0 8px rgba(255,255,255,0.2)" }}>
                  {formatUsd(price)}
                </p>
                {changePct !== null && (
                  <p
                    className="font-mono text-xs font-semibold tabular-nums"
                    style={{
                      color: up ? "#34d399" : "#f87171",
                      textShadow: up ? "0 0 8px rgba(52,211,153,0.5)" : "0 0 8px rgba(248,113,113,0.5)",
                    }}
                  >
                    {up ? "▲" : "▼"} {Math.abs(changePct).toFixed(2)}%
                  </p>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="font-mono text-[11px] px-2.5 py-1.5 transition-all"
              style={{
                color: "rgba(34,211,238,0.6)",
                border: "1px solid rgba(34,211,238,0.25)",
                borderRadius: 4,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "#22d3ee";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(34,211,238,0.6)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 8px rgba(34,211,238,0.2)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "rgba(34,211,238,0.6)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(34,211,238,0.25)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
              }}
            >
              [ESC]
            </button>
          </div>
        </div>

        {/* Interval selector */}
        <div className="scrollbar-hide flex gap-1.5 overflow-x-auto px-4 py-2.5 [-webkit-overflow-scrolling:touch]" style={{ borderBottom: "1px solid rgba(6,182,212,0.08)" }}>
          {INTERVALS.map((iv) => (
            <button
              key={iv}
              type="button"
              onClick={() => setInterval(iv)}
              className="shrink-0 whitespace-nowrap font-mono text-[11px] px-2.5 py-1 transition-all rounded-sm"
              style={
                interval === iv
                  ? {
                      background: "rgba(34,211,238,0.15)",
                      border: "1px solid rgba(34,211,238,0.5)",
                      color: "#22d3ee",
                      boxShadow: "0 0 8px rgba(34,211,238,0.2), inset 0 0 8px rgba(34,211,238,0.05)",
                    }
                  : {
                      border: "1px solid rgba(100,116,139,0.3)",
                      color: "rgba(148,163,184,0.5)",
                    }
              }
            >
              {iv === "ALL" ? "IPO+" : iv}
            </button>
          ))}
        </div>

        {/* Chart */}
        <div className="relative h-56 px-3 pb-3 pt-2 sm:h-72">
          {loading ? (
            <div className="flex h-full flex-col items-center justify-center gap-2">
              <div className="font-mono text-xs text-cyan-500/60 tracking-widest animate-pulse">LOADING DATA STREAM...</div>
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-cyan-500/60 animate-bounce"
                    style={{ animationDelay: `${i * 100}ms` }}
                  />
                ))}
              </div>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="font-mono text-sm text-slate-500">// NO DATA AVAILABLE</p>
            </div>
          ) : (
            <>
              {/* Glow behind chart */}
              <div
                className="pointer-events-none absolute inset-x-3 bottom-3 top-2 opacity-30 blur-2xl"
                style={{ background: `radial-gradient(ellipse at 50% 80%, ${neonGlow} 0%, transparent 70%)` }}
              />
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 8" stroke="rgba(6,182,212,0.08)" vertical={false} />
                  <XAxis
                    dataKey="idx"
                    minTickGap={36}
                    tick={{ fontSize: 9, fill: "rgba(6,182,212,0.45)", fontFamily: "monospace" }}
                    tickLine={false}
                    axisLine={{ stroke: "rgba(6,182,212,0.15)" }}
                    tickFormatter={(v) => {
                      const row = rows[Number(v)];
                      if (!row) return "";
                      const d = new Date(row.at);
                      return interval === "1D"
                        ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                        : interval === "5Y" || interval === "ALL"
                        ? d.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
                        : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                    }}
                  />
                  <YAxis
                    domain={["auto", "auto"]}
                    tick={{ fontSize: 9, fill: "rgba(6,182,212,0.45)", fontFamily: "monospace" }}
                    width={52}
                    tickLine={false}
                    axisLine={{ stroke: "rgba(6,182,212,0.15)" }}
                    tickFormatter={(v) => `$${formatNumber(Number(v), 0)}`}
                  />
                  <Tooltip
                    cursor={{ stroke: "rgba(6,182,212,0.4)", strokeWidth: 1, strokeDasharray: "3 3" }}
                    formatter={(value) => [formatUsd(Number(value)), symbol]}
                    labelFormatter={(label) => {
                      const row = rows[Number(label)];
                      if (!row) return "";
                      return new Date(row.at).toLocaleString("en-US", {
                        month: "short", day: "numeric", year: "numeric",
                        hour: interval === "1D" ? "numeric" : undefined,
                        minute: interval === "1D" ? "2-digit" : undefined,
                      });
                    }}
                    contentStyle={{
                      background: "rgba(2,8,16,0.97)",
                      border: `1px solid ${neonLine}40`,
                      borderRadius: 6,
                      fontSize: 11,
                      fontFamily: "monospace",
                      boxShadow: `0 0 12px ${neonGlow}`,
                      color: "#e2e8f0",
                    }}
                    labelStyle={{ color: "rgba(148,163,184,0.7)", marginBottom: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="close"
                    stroke={neonLine}
                    strokeWidth={2}
                    dot={false}
                    style={{ filter: `drop-shadow(0 0 4px ${neonLine}80)` }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </>
          )}
        </div>

        {/* HUD corners on whole card */}
        <HudCorner pos="bl" />
        <HudCorner pos="br" />

        {/* Bottom accent bar */}
        <div className="h-px w-full" style={{ background: "linear-gradient(90deg, transparent, rgba(167,139,250,0.7) 30%, rgba(6,182,212,0.7) 70%, transparent)" }} />
      </div>
    </div>
  );
}
