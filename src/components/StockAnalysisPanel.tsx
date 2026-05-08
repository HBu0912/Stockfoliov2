"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMarketCap, formatNumber, formatUsd } from "@/lib/money";
import { StockTrendsModal } from "@/components/StockTrendsModal";

const intervals = ["1D", "1W", "1M", "3M", "YTD", "1Y", "5Y", "ALL"] as const;
type IntervalKey = (typeof intervals)[number];
const LS_METRIC_ORDER = "pf-stock-analysis-metric-order-v1";
const LS_HIDE_VALUES = "pf-hide-values";
const LS_CHART_SMA = "pf-stock-chart-sma-v1";

function readChartSmaPrefs(): { ma20: boolean; ma50: boolean } {
  if (typeof window === "undefined") return { ma20: false, ma50: false };
  try {
    const raw = window.localStorage.getItem(LS_CHART_SMA);
    if (!raw) return { ma20: false, ma50: false };
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object") return { ma20: false, ma50: false };
    const o = j as Record<string, unknown>;
    return {
      ma20: o.ma20 === true,
      ma50: o.ma50 === true,
    };
  } catch {
    return { ma20: false, ma50: false };
  }
}
const DEFAULT_METRIC_ORDER = [
  "next_earnings",
  "market_cap",
  "sector",
  "industry",
  "beta",
  "pe",
  "forward_pe",
  "peg",
  "price_book",
  "enterprise_value",
  "ev_revenue",
  "ev_ebitda",
  "profit_margin",
  "roe",
  "div_yield",
  "eps_ttm",
  "eps_fwd",
  "annual_div",
  "chg_52w",
  "avg_50d",
  "avg_200d",
  "vol_day",
  "vol_10d",
  "vol_3m",
  "range_52w",
] as const;
type MetricId = (typeof DEFAULT_METRIC_ORDER)[number];

type PortfolioAllocation = {
  inPortfolio: boolean;
  allocationPct: number | null;
  positionValue: number;
  portfolioValue: number;
};

type Payload = {
  symbol: string;
  name: string;
  interval: IntervalKey;
  chart: Array<{ at: string; close: number }>;
  smaBaseChart?: Array<{ at: string; close: number }>;
  changePct: number | null;
  sector: string | null;
  industry: string | null;
  exchange: string | null;
  currency: string | null;
  marketState: string | null;
  nextEarnings: {
    at: string;
    isEstimate: boolean | null;
  } | null;
  overview: string | null;
  analyst: {
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
  } | null;
  analystTargets: {
    targetHigh: number | null;
    targetLow: number | null;
    targetMean: number | null;
    targetMedian: number | null;
    numAnalysts: number | null;
    recommendationKey: string | null;
  } | null;
  news: Array<{
    id: string;
    title: string;
    publisher: string;
    link: string;
    publishedAt: string | null;
  }>;
  newsMeta: {
    limit: number;
    offset: number;
    returned: number;
    totalAvailable: number;
    fetched: number;
    hasMore: boolean;
  };
  context: {
    avgVolume10Day: number | null;
    avgVolume3Month: number | null;
    regularMarketVolume: number | null;
    fiftyDayAverage: number | null;
    twoHundredDayAverage: number | null;
    fiftyTwoWeekChangePercent: number | null;
    trailingAnnualDividendRate: number | null;
    epsTrailingTwelveMonths: number | null;
    epsForward: number | null;
  };
  metrics: {
    price: number | null;
    marketCap: number | null;
    marketCapText: string | null;
    totalRevenue: number | null;
    grossMargins: number | null;
    operatingMargins: number | null;
    ebitdaMargins: number | null;
    beta: number | null;
    trailingPE: number | null;
    forwardPE: number | null;
    pegRatio: number | null;
    priceToBook: number | null;
    profitMargin: number | null;
    returnOnEquity: number | null;
    dividendYield: number | null;
    enterpriseValue: number | null;
    enterpriseToRevenue: number | null;
    enterpriseToEbitda: number | null;
    week52Low: number | null;
    week52High: number | null;
  };
};

function formatPct(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `${formatNumber(v * 100, 2)}%`;
}

function hasAny(text: string, keywords: string[]): boolean {
  const t = text.toLowerCase();
  return keywords.some((k) => t.includes(k));
}

function detectBusinessSegments(symbol: string, overview: string): string[] {
  const o = overview.toLowerCase();
  if (symbol === "GOOGL" || symbol === "GOOG") {
    return ["Search ads", "YouTube", "Google Cloud", "Android ecosystem", "Other bets"];
  }
  const out: string[] = [];
  if (hasAny(o, ["search", "advertis", "ad platform"])) out.push("Search/Ads");
  if (hasAny(o, ["cloud", "infrastructure", "iaas", "saas"])) out.push("Cloud");
  if (hasAny(o, ["youtube", "streaming", "media"])) out.push("Streaming/Media");
  if (hasAny(o, ["subscription", "membership"])) out.push("Subscription");
  if (hasAny(o, ["hardware", "device", "consumer electronics"])) out.push("Hardware");
  if (hasAny(o, ["payments", "fintech", "wallet"])) out.push("Payments/Fintech");
  if (hasAny(o, ["drug", "biotech", "clinical", "therapeutic"])) out.push("Biopharma pipeline");
  if (hasAny(o, ["semiconductor", "chip", "gpu", "foundry"])) out.push("Semiconductor");
  return [...new Set(out)].slice(0, 5);
}

function pickSourceLines(data: Payload) {
  const items = data.news.slice(0, 12).filter((n) => n.publisher && n.title);
  const bullish = items
    .filter((n) => hasAny(n.title.toLowerCase(), ["upgrade", "outperform", "buy", "beat", "raises target", "bull"]))
    .slice(0, 2)
    .map((n) => `${n.publisher}: "${n.title}"`);
  const bearish = items
    .filter((n) => hasAny(n.title.toLowerCase(), ["downgrade", "underperform", "sell", "miss", "cuts target", "bear", "risk"]))
    .slice(0, 2)
    .map((n) => `${n.publisher}: "${n.title}"`);
  return { bullish, bearish };
}

function inferBusinessModel(data: Payload): string {
  const text = `${data.overview ?? ""} ${data.sector ?? ""} ${data.industry ?? ""}`.toLowerCase();
  if (hasAny(text, ["subscription", "saas", "cloud", "platform"])) return "subscription/platform model";
  if (hasAny(text, ["semiconductor", "chip", "gpu", "foundry"])) return "semiconductor supply-chain model";
  if (hasAny(text, ["bank", "lending", "deposit", "credit"])) return "balance-sheet and lending model";
  if (hasAny(text, ["drug", "biotech", "clinical", "pharma"])) return "drug pipeline model";
  if (hasAny(text, ["advertis", "marketplace", "e-commerce", "retail"])) return "consumer demand and ad/commerce model";
  if (hasAny(text, ["oil", "gas", "upstream", "midstream", "refining", "energy"])) return "commodity-linked energy model";
  return "operating scale and execution model";
}

function buildBullsVsBears(data: Payload | null): { bulls: string[]; bears: string[] } {
  if (!data) return { bulls: [], bears: [] };
  const bulls: string[] = [];
  const bears: string[] = [];
  const overview = data.overview ?? "";
  const headlineBlob = data.news.slice(0, 8).map((n) => n.title).join(" ").toLowerCase();
  const model = inferBusinessModel(data);
  const segments = detectBusinessSegments(data.symbol, overview);
  const sectorLabel = data.sector ?? "sector";
  const industryLabel = data.industry ?? "industry";
  const margin = data.metrics.profitMargin ?? null;
  const opMargin = data.metrics.operatingMargins ?? null;
  const grossMargin = data.metrics.grossMargins ?? null;
  const revenue = data.metrics.totalRevenue ?? null;
  const roe = data.metrics.returnOnEquity ?? null;
  const pe = data.metrics.trailingPE ?? null;
  const beta = data.metrics.beta ?? null;
  const div = data.metrics.dividendYield ?? null;
  const analyst = data.analyst;
  const sources = pickSourceLines(data);
  const analystBull = (analyst?.strongBuy ?? 0) + (analyst?.buy ?? 0);
  const analystBear = (analyst?.sell ?? 0) + (analyst?.strongSell ?? 0);

  bulls.push(`Business model: ${data.name} runs a ${model} profile in ${industryLabel}.`);
  if (segments.length) bulls.push(`Core revenue engines: ${segments.join(", ")}.`);
  if (revenue != null) bulls.push(`Scale check: revenue run-rate is about ${formatMarketCap(revenue)}.`);
  if (hasAny(overview.toLowerCase(), ["recurring", "subscription", "long-term contract", "enterprise"])) {
    bulls.push("Revenue quality: recurring or contract-like customer relationships.");
  }
  if (hasAny(overview.toLowerCase(), ["network", "ecosystem", "brand", "distribution", "proprietary"])) {
    bulls.push("Potential moat: ecosystem/brand/distribution effects that are difficult for peers to replicate quickly.");
  }
  if (margin != null && margin > 0.15) {
    bulls.push("Operating profile shows strong margins, supporting reinvestment and resilience.");
  } else if (margin != null && margin < 0.05) {
    bears.push("Thin margins leave less buffer if demand softens or costs rise.");
  }
  if (roe != null && roe > 0.15) {
    bulls.push("High ROE supports the bull case for efficient capital deployment.");
  } else if (roe != null && roe < 0.08) {
    bears.push("Lower ROE suggests weaker capital efficiency versus stronger peers.");
  }
  if (pe != null && pe > 35) {
    bears.push("Valuation rich: expectations and execution risk both elevated.");
  } else if (pe != null && pe > 0 && pe < 18) {
    bulls.push("Valuation is more moderate versus many growth-heavy comps.");
  }
  if (beta != null && beta > 1.35) {
    bears.push("High beta indicates larger swings in risk-off markets.");
  } else if (beta != null && beta < 0.9) {
    bulls.push("Lower beta profile can dampen broad market drawdowns.");
  }
  if (div != null && div > 1.5) {
    bulls.push("Dividend profile adds a return component beyond multiple expansion.");
  }
  if (analyst) {
    const positive = analystBull;
    const negative = analystBear;
    if (positive > negative) bulls.push("Street positioning is currently more constructive than bearish.");
    if (negative >= positive && negative > 0) bears.push("Analyst split still includes notable downgrade pressure.");
    bears.push(
      `Analyst split: ${positive} bullish vs ${negative} bearish (holds: ${analyst.hold ?? 0}) - disagreement can drive volatility around earnings.`
    );
  }
  if (sources.bullish.length) bulls.push(`Analyst/commentary sources: ${sources.bullish.join(" | ")}`);
  if (sources.bearish.length) bears.push(`Risk-leaning sources: ${sources.bearish.join(" | ")}`);
  if (hasAny(headlineBlob, ["guidance raised", "beat", "partnership", "approval", "expansion"])) {
    bulls.push("Recent headline flow includes catalysts (beats/approvals/partnerships/expansion).");
  }
  if (hasAny(headlineBlob, ["investigation", "lawsuit", "cut guidance", "downgrade", "layoffs"])) {
    bears.push("Headline pressure points: legal/guidance/labor sentiment.");
  }
  bears.push(`Industry structure: ${industryLabel} competitive intensity can pressure share and pricing.`);
  if (analystBear > 0) bears.push(`Analyst caution: ${analystBear} bearish calls currently on record.`);
  bears.push(`Regulatory pressure in ${sectorLabel} can compress margins and multiples.`);
  return { bulls: bulls.slice(0, 7), bears: bears.slice(0, 8) };
}

function buildSwat(data: Payload | null): { strengths: string[]; weaknesses: string[]; advantages: string[]; threats: string[] } {
  if (!data) return { strengths: [], weaknesses: [], advantages: [], threats: [] };
  const overview = (data.overview ?? "").toLowerCase();
  const headlines = data.news.slice(0, 10).map((n) => n.title.toLowerCase()).join(" ");
  const sourceLines = pickSourceLines(data);
  const segments = detectBusinessSegments(data.symbol, data.overview ?? "");
  const out = {
    strengths: [] as string[],
    weaknesses: [] as string[],
    advantages: [] as string[],
    threats: [] as string[],
  };
  const m = data.metrics;
  const analyst = data.analyst;
  const analystBull = (analyst?.strongBuy ?? 0) + (analyst?.buy ?? 0);
  const analystBear = (analyst?.sell ?? 0) + (analyst?.strongSell ?? 0);
  const revenueText = m.totalRevenue != null ? formatMarketCap(m.totalRevenue) : "n/a";
  const marginText = `gross ${formatPct(m.grossMargins)} / operating ${formatPct(m.operatingMargins)} / net ${formatPct(m.profitMargin)}`;
  if ((m.profitMargin ?? 0) > 0.12) out.strengths.push("Profitability is healthy enough to support reinvestment through cycle changes.");
  if ((m.returnOnEquity ?? 0) > 0.14) out.strengths.push("ROE suggests the company converts capital into returns efficiently.");
  out.strengths.push(`Quant snapshot: revenue ${revenueText}; margin stack ${marginText}.`);
  if (segments.length) out.advantages.push(`Business mix diversification: ${segments.join(", ")}.`);
  if (hasAny(overview, ["patent", "proprietary", "network", "ecosystem", "scale"])) {
    out.strengths.push("Business description signals structural moat characteristics (scale/network/proprietary assets).");
  }
  if ((m.trailingPE ?? 0) > 35) out.weaknesses.push("Premium valuation leaves narrow room for execution misses.");
  if ((m.profitMargin ?? 1) < 0.06) out.weaknesses.push("Lower margin structure reduces earnings durability in downturns.");
  if (hasAny(overview, ["cyclical", "commodity", "discretionary"])) {
    out.weaknesses.push(`Industry cyclicality: ${data.industry ?? data.sector ?? "core market"} is sensitive to demand swings and macro timing.`);
  }
  if (data.context.regularMarketVolume && data.context.regularMarketVolume > 5_000_000)
    out.advantages.push("High liquidity supports easier entry/exit and tighter spreads.");
  out.advantages.push(
    `Positioning in ${data.industry ?? data.sector ?? "its market"} can benefit from durable demand drivers if execution remains consistent.`
  );
  if (analyst) out.advantages.push(`Analyst positioning: ${analystBull} bullish vs ${analystBear} bearish ratings.`);
  if (hasAny(headlines, ["approval", "contract", "launch", "partnership"])) {
    out.advantages.push("Recent headlines suggest active catalyst momentum (commercial/partnership/product).");
  }
  out.threats.push("Macro rates and risk-premium expansion can compress growth multiples.");
  out.threats.push(`Competitive disruption risk remains relevant in ${data.industry ?? data.sector ?? "its operating market"}.`);
  if (hasAny(headlines, ["investigation", "lawsuit", "regulator", "ban"])) {
    out.threats.push("Regulatory/legal overhang in headline flow.");
  }
  if (sourceLines.bullish.length) out.strengths.push(`Source support: ${sourceLines.bullish[0]}`);
  if (sourceLines.bearish.length) out.threats.push(`Source warning: ${sourceLines.bearish[0]}`);
  return out;
}

function formatXAxis(dateISO: string, interval: IntervalKey): string {
  const d = new Date(dateISO);
  if (interval === "1D") {
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  if (interval === "1W") {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  if (interval === "5Y" || interval === "ALL") {
    return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTooltipDate(dateISO: string, interval: IntervalKey): string {
  const d = new Date(dateISO);
  if (interval === "1D" || interval === "1W") {
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatAxisNumber(v: number): string {
  return v.toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 0 });
}

/** Simple moving average; null until `period` closes exist. */
function computeSma(closes: number[], period: number): (number | null)[] {
  if (period <= 0 || closes.length === 0) return closes.map(() => null);
  const out: (number | null)[] = [];
  let sum = 0;
  const window: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    const v = closes[i]!;
    window.push(v);
    sum += v;
    if (window.length > period) sum -= window.shift()!;
    out.push(window.length === period ? sum / period : null);
  }
  return out;
}

function formatEarningsDate(dateISO: string): string {
  return new Date(dateISO).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function initialMetricOrder(): MetricId[] {
  if (typeof window === "undefined") return [...DEFAULT_METRIC_ORDER];
  try {
    const raw = window.localStorage.getItem(LS_METRIC_ORDER);
    if (!raw) return [...DEFAULT_METRIC_ORDER];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...DEFAULT_METRIC_ORDER];
    const cleaned = parsed.filter((x): x is MetricId =>
      DEFAULT_METRIC_ORDER.includes(x as MetricId)
    );
    const missing = DEFAULT_METRIC_ORDER.filter((id) => !cleaned.includes(id));
    return [...cleaned, ...missing];
  } catch {
    return [...DEFAULT_METRIC_ORDER];
  }
}

function minutesInNewYork(dateISO: string): number {
  const d = new Date(dateISO);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function newYorkDateKey(dateISO: string): string {
  const d = new Date(dateISO);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function readActiveIdx(state: unknown): number | null {
  if (typeof state !== "object" || state == null) return null;
  const idx = (state as { activeTooltipIndex?: unknown }).activeTooltipIndex;
  if (typeof idx === "number" && Number.isFinite(idx)) return idx;
  const activeLabel = (state as { activeLabel?: unknown }).activeLabel;
  if (typeof activeLabel === "number" && Number.isFinite(activeLabel)) return activeLabel;
  if (typeof activeLabel === "string") {
    const parsed = Number(activeLabel);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

type ChartRowPayload = {
  at: string;
  close: number;
  idx: number;
  label: string;
  tooltipLabel: string;
  ma20: number | null;
  ma50: number | null;
};

function PriceTooltip({
  active,
  payload,
  interval,
  showMa20,
  showMa50,
}: {
  active?: boolean;
  payload?: Array<{ payload?: ChartRowPayload }>;
  interval: IntervalKey;
  showMa20: boolean;
  showMa50: boolean;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as ChartRowPayload | undefined;
  if (!row?.at || row.close == null) return null;
  return (
    <div className="rounded-xl border border-(--card-border) bg-(--card) px-3 py-2 text-xs shadow-lg">
      <p className="text-(--muted)">{formatTooltipDate(row.at, interval)}</p>
      <p className="mt-1 text-sm font-semibold">{formatUsd(row.close)}</p>
      {(showMa20 && row.ma20 != null) || (showMa50 && row.ma50 != null) ? (
        <div className="mt-2 space-y-0.5 border-t border-(--card-border) pt-2 text-[11px]">
          {showMa20 && row.ma20 != null ? (
            <p className="text-amber-200/95">
              SMA 20 · <span className="font-semibold tabular-nums">{formatUsd(row.ma20)}</span>
            </p>
          ) : null}
          {showMa50 && row.ma50 != null ? (
            <p className="text-violet-300/95">
              SMA 50 · <span className="font-semibold tabular-nums">{formatUsd(row.ma50)}</span>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AnalystRatingBubbles({ analyst }: { analyst: NonNullable<Payload["analyst"]> }) {
  const items = [
    { key: "strongBuy", label: "Strong buy", count: analyst.strongBuy, bubble: "bg-green-800 text-white" },
    { key: "buy", label: "Buy", count: analyst.buy, bubble: "bg-green-300 text-green-950" },
    { key: "hold", label: "Hold", count: analyst.hold, bubble: "bg-yellow-300 text-yellow-950" },
    { key: "sell", label: "Sell", count: analyst.sell, bubble: "bg-orange-500 text-white" },
    { key: "strongSell", label: "Strong sell", count: analyst.strongSell, bubble: "bg-red-600 text-white" },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {items.map((item) => (
        <div
          key={item.key}
          className={
            "rounded-2xl border border-(--card-border) px-3 py-3 text-center shadow-sm " + item.bubble
          }
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide opacity-90">{item.label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{item.count}</p>
        </div>
      ))}
    </div>
  );
}

export function StockAnalysisPanel({
  symbol,
  showOpenPageButton = true,
  defaultInterval = "1M",
}: {
  symbol: string;
  showOpenPageButton?: boolean;
  defaultInterval?: IntervalKey;
}) {
  const [interval, setInterval] = useState<IntervalKey>(defaultInterval);
  const [reloadToken, setReloadToken] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Payload | null>(null);
  const [allocation, setAllocation] = useState<PortfolioAllocation | null>(null);
  const [metricOrder, setMetricOrder] = useState<MetricId[]>(initialMetricOrder);
  const [editingMetrics, setEditingMetrics] = useState(false);
  const [dragMetricId, setDragMetricId] = useState<MetricId | null>(null);

  const [trendsOpen, setTrendsOpen] = useState(false);
  const chartPlotRef = useRef<HTMLDivElement>(null);

  const [newsOffset, setNewsOffset] = useState(0);
  const newsLimit = 5;

  const [dragging, setDragging] = useState(false);
  const [dragStartIdx, setDragStartIdx] = useState<number | null>(null);
  const [dragEndIdx, setDragEndIdx] = useState<number | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [hideValues, setHideValues] = useState(false);
  const [insightView, setInsightView] = useState<"bullsBears" | "swat">("bullsBears");
  const [showMa20, setShowMa20] = useState(() => readChartSmaPrefs().ma20);
  const [showMa50, setShowMa50] = useState(() => readChartSmaPrefs().ma50);

  useEffect(() => {
    function syncHideValues() {
      try {
        setHideValues(localStorage.getItem(LS_HIDE_VALUES) === "1");
      } catch {
        setHideValues(false);
      }
    }
    syncHideValues();
    window.addEventListener("privacy-visibility-changed", syncHideValues);
    window.addEventListener("storage", syncHideValues);
    return () => {
      window.removeEventListener("privacy-visibility-changed", syncHideValues);
      window.removeEventListener("storage", syncHideValues);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!symbol) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          interval,
          newsLimit: String(newsLimit),
          newsOffset: String(newsOffset),
          includeWarmup: "1",
        });
        const res = await fetch(`/api/stocks/${encodeURIComponent(symbol)}?${params.toString()}`);
        const json = (await res.json().catch(() => ({}))) as Payload & { error?: string };
        if (!res.ok) {
          if (!cancelled) setError(json.error ?? "Could not load stock analysis.");
          return;
        }
        if (!cancelled) {
          const meta = json.newsMeta;
          const hasMore =
            typeof meta?.hasMore === "boolean"
              ? meta.hasMore
              : (meta?.totalAvailable ?? 0) > (meta?.offset ?? 0) + (meta?.limit ?? newsLimit);
          setData({
            ...json,
            newsMeta: meta
              ? {
                  ...meta,
                  hasMore,
                }
              : json.newsMeta,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [symbol, interval, reloadToken, newsOffset]);

  useEffect(() => {
    setInterval(defaultInterval);
  }, [symbol, defaultInterval]);

  useEffect(() => {
    let cancelled = false;
    async function loadAllocation() {
      if (!symbol) return;
      try {
        const res = await fetch(
          `/api/portfolio/allocation?symbol=${encodeURIComponent(symbol.trim().toUpperCase())}`
        );
        const json = (await res.json().catch(() => ({}))) as PortfolioAllocation & { error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setAllocation(null);
          return;
        }
        setAllocation({
          inPortfolio: !!json.inPortfolio,
          allocationPct:
            json.allocationPct != null && Number.isFinite(json.allocationPct) ? json.allocationPct : null,
          positionValue: typeof json.positionValue === "number" ? json.positionValue : 0,
          portfolioValue: typeof json.portfolioValue === "number" ? json.portfolioValue : 0,
        });
      } catch {
        if (!cancelled) setAllocation(null);
      }
    }
    void loadAllocation();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_METRIC_ORDER, JSON.stringify(metricOrder));
    } catch {
      // ignore
    }
  }, [metricOrder]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_CHART_SMA, JSON.stringify({ ma20: showMa20, ma50: showMa50 }));
    } catch {
      // ignore
    }
  }, [showMa20, showMa50]);

  const rangePct = useMemo(() => {
    if (!data?.metrics.week52Low || !data.metrics.week52High || !data.metrics.price) return null;
    const denom = data.metrics.week52High - data.metrics.week52Low;
    if (denom <= 0) return null;
    return Math.max(0, Math.min(100, ((data.metrics.price - data.metrics.week52Low) / denom) * 100));
  }, [data]);

  const chartRows = useMemo((): ChartRowPayload[] => {
    const rows = data?.chart ?? [];
    const base = data?.smaBaseChart?.length ? data.smaBaseChart : rows;
    const baseSma20 = computeSma(base.map((r) => r.close), 20);
    const baseSma50 = computeSma(base.map((r) => r.close), 50);
    const byAt = new Map<string, { ma20: number | null; ma50: number | null }>();
    for (let i = 0; i < base.length; i++) {
      const at = base[i]?.at;
      if (!at) continue;
      byAt.set(at, { ma20: baseSma20[i] ?? null, ma50: baseSma50[i] ?? null });
    }
    return rows.map((row, idx) => ({
      ...row,
      idx,
      label: formatXAxis(row.at, interval),
      tooltipLabel: formatTooltipDate(row.at, interval),
      ma20: byAt.get(row.at)?.ma20 ?? null,
      ma50: byAt.get(row.at)?.ma50 ?? null,
    }));
  }, [data, interval]);

  const headerChange = data?.changePct ?? null;
  const isNegative = headerChange != null && headerChange < 0;

  const selectedRange = useMemo(() => {
    if (dragStartIdx == null || dragEndIdx == null || chartRows.length === 0) return null;
    const left = Math.max(0, Math.min(dragStartIdx, dragEndIdx));
    const right = Math.min(chartRows.length - 1, Math.max(dragStartIdx, dragEndIdx));
    if (left === right) return null;
    const start = chartRows[left]?.close;
    const end = chartRows[right]?.close;
    if (start == null || end == null || start === 0) return null;
    return {
      left,
      right,
      pct: ((end - start) / start) * 100,
      startLabel: chartRows[left]?.tooltipLabel,
      endLabel: chartRows[right]?.tooltipLabel,
    };
  }, [chartRows, dragStartIdx, dragEndIdx]);

  const latestNyDateKey = useMemo(() => {
    if (interval !== "1D" || chartRows.length === 0) return null;
    return chartRows.map((r) => newYorkDateKey(r.at)).sort().at(-1) ?? null;
  }, [interval, chartRows]);

  const marketOpenIdx = useMemo(() => {
    if (interval !== "1D" || chartRows.length === 0 || !latestNyDateKey) return null;
    return (
      chartRows.find((r) => {
        return newYorkDateKey(r.at) === latestNyDateKey && minutesInNewYork(r.at) >= 9 * 60 + 30;
      })?.idx ?? null
    );
  }, [interval, chartRows, latestNyDateKey]);

  const marketCloseIdx = useMemo(() => {
    if (interval !== "1D" || chartRows.length === 0 || !latestNyDateKey) return null;
    return (
      chartRows.find((r) => {
        return newYorkDateKey(r.at) === latestNyDateKey && minutesInNewYork(r.at) >= 16 * 60;
      })?.idx ?? null
    );
  }, [interval, chartRows, latestNyDateKey]);

  const weekOpenIdxSet = useMemo(() => {
    if (interval !== "1W" || chartRows.length === 0) return new Set<number>();
    const out = new Set<number>();
    const seen = new Set<string>();
    for (const row of chartRows) {
      const day = newYorkDateKey(row.at);
      if (seen.has(day)) continue;
      if (minutesInNewYork(row.at) >= 9 * 60 + 30) {
        seen.add(day);
        out.add(row.idx);
      }
    }
    return out;
  }, [interval, chartRows]);

  const xTickFormatter = useMemo(() => {
    if (interval === "1W") {
      return (value: number) => {
        const idx = Number(value);
        if (!weekOpenIdxSet.has(idx)) return "";
        return chartRows[idx]?.label ?? "";
      };
    }
    if (interval !== "1D") {
      return (value: number) => chartRows[Number(value)]?.label ?? "";
    }
    return (value: number) => {
      if (marketOpenIdx != null && value === marketOpenIdx) return "9:30 AM";
      if (marketCloseIdx != null && value === marketCloseIdx) return "4:00 PM";
      return "";
    };
  }, [interval, marketOpenIdx, marketCloseIdx, chartRows, weekOpenIdxSet]);

  const chartBubblePct = selectedRange?.pct ?? headerChange;
  const bullsBears = useMemo(() => buildBullsVsBears(data), [data]);
  const swat = useMemo(() => buildSwat(data), [data]);
  const openMarkerLeftPct =
    interval === "1D" && marketOpenIdx != null && chartRows.length > 1
      ? (marketOpenIdx / (chartRows.length - 1)) * 100
      : null;
  const closeMarkerLeftPct =
    interval === "1D" && marketCloseIdx != null && chartRows.length > 1
      ? (marketCloseIdx / (chartRows.length - 1)) * 100
      : null;

  function moveMetric(dragId: MetricId, dropId: MetricId) {
    setMetricOrder((prev) => {
      const from = prev.indexOf(dragId);
      const to = prev.indexOf(dropId);
      if (from < 0 || to < 0 || from === to) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">
            {data?.symbol ?? symbol.toUpperCase()}
            <span className={"ml-2 text-lg font-bold " + ((chartBubblePct ?? 0) < 0 ? "text-rose-300" : "text-emerald-300")}>
              {formatUsd(data?.metrics.price)}
            </span>
          </h3>
          <p className="text-sm text-(--muted)">{data?.name ?? "Loading company..."}</p>
          <p className="mt-1 text-xs text-(--muted)">
            {[data?.exchange, data?.currency, data?.marketState].filter(Boolean).join(" · ")}
          </p>
          {allocation?.inPortfolio && allocation.allocationPct != null ? (
            <p className="mt-1 text-xs text-(--muted)">
              Your portfolio:{" "}
              <span className="font-semibold text-foreground">
                {formatNumber(allocation.allocationPct, 2)}%
              </span>{" "}
              of total value is in this ticker
              {allocation.portfolioValue > 0 ? (
                <span className="text-(--muted)">
                  {" "}
                  ({hideValues ? "••••" : formatUsd(allocation.positionValue)} / {hideValues ? "••••" : formatUsd(allocation.portfolioValue)})
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setNewsOffset(0);
                setDragStartIdx(null);
                setDragEndIdx(null);
                setReloadToken((t) => t + 1);
              }}
              className="rounded-md border border-(--card-border) px-3 py-1.5 text-xs hover:bg-(--background)"
            >
              Refresh
            </button>
            {showOpenPageButton && (
              <Link
                href={`/stock-analysis?symbol=${encodeURIComponent(symbol.toUpperCase())}`}
                className="rounded-md border border-(--card-border) px-3 py-1.5 text-xs hover:bg-(--background)"
              >
                View in Charts
              </Link>
            )}
          </div>
          <button
            type="button"
            onClick={() => setTrendsOpen(true)}
            className="rounded-md border border-(--card-border) px-3 py-1.5 text-xs hover:bg-(--background)"
          >
            View Trends
          </button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="flex flex-wrap gap-1">
                {intervals.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      setInterval(k);
                      setNewsOffset(0);
                      setDragStartIdx(null);
                      setDragEndIdx(null);
                    }}
                    className={
                      "rounded-md px-2 py-1 text-xs " +
                      (interval === k
                        ? "bg-(--accent) text-(--accent-foreground)"
                        : "border border-(--card-border) hover:bg-(--background)")
                    }
                  >
                    {k}
                  </button>
                ))}
              </div>
              <span className="hidden h-5 w-px shrink-0 bg-(--card-border) sm:block" aria-hidden />
              <div className="group relative">
                <button
                  type="button"
                  className="rounded-md border border-(--card-border) px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-(--muted) hover:bg-(--background)"
                >
                  Avg
                </button>
                <div className="invisible absolute left-0 top-full z-20 min-w-[120px] pt-1 opacity-0 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                  <div className="rounded-lg border border-(--card-border) bg-(--card) p-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => setShowMa20((v) => !v)}
                      title="20-period simple moving average"
                      className={
                        "block w-full rounded-md px-2 py-1 text-left text-xs tabular-nums " +
                        (showMa20
                          ? "bg-amber-500/25 text-amber-100 ring-1 ring-amber-400/40"
                          : "text-(--muted) hover:bg-(--background)")
                      }
                    >
                      SMA 20
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowMa50((v) => !v)}
                      title="50-period simple moving average"
                      className={
                        "mt-1 block w-full rounded-md px-2 py-1 text-left text-xs tabular-nums " +
                        (showMa50
                          ? "bg-violet-500/25 text-violet-100 ring-1 ring-violet-400/35"
                          : "text-(--muted) hover:bg-(--background)")
                      }
                    >
                      SMA 50
                    </button>
                  </div>
                </div>
              </div>
            </div>
            {chartBubblePct != null && (
              <div className="rounded-full border border-(--card-border) bg-(--card)/95 px-3 py-1 text-xs shadow-sm">
                <span className={"whitespace-nowrap " + (chartBubblePct < 0 ? "text-red-400" : "text-emerald-300")}>
                  {selectedRange
                    ? `${selectedRange.startLabel ?? ""} → ${selectedRange.endLabel ?? ""} · `
                    : `${interval} · `}
                  {chartBubblePct > 0 ? "+" : ""}
                  {formatNumber(chartBubblePct, 2)}%
                </span>
              </div>
            )}
          </div>

          <div className="relative h-80 select-none rounded-xl border border-(--card-border) bg-(--background) p-2 lg:h-96">
            {loading ? (
              <p className="px-2 py-3 text-sm text-(--muted)">Loading chart...</p>
            ) : error ? (
              <p className="px-2 py-3 text-sm text-red-400">{error}</p>
            ) : chartRows.length === 0 ? (
              <p className="px-2 py-3 text-sm text-(--muted)">No chart data available.</p>
            ) : (
              <div ref={chartPlotRef} className="relative h-full w-full cursor-crosshair">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartRows}
                  margin={{ top: 20, right: 8, left: 0, bottom: 0 }}
                  onMouseDown={(state) => {
                    const idx = readActiveIdx(state);
                    if (idx == null) return;
                    setDragging(true);
                    setDragStartIdx(idx);
                    setDragEndIdx(idx);
                    setHoverIdx(null);
                  }}
                  onMouseMove={(state) => {
                    const idx = readActiveIdx(state);
                    if (dragging) {
                      if (idx != null) setDragEndIdx(idx);
                      return;
                    }
                    if (idx != null && idx !== hoverIdx) setHoverIdx(idx);
                  }}
                  onMouseUp={(state) => {
                    if (!dragging) return;
                    const idx = readActiveIdx(state);
                    if (idx != null) setDragEndIdx(idx);
                    setDragging(false);
                  }}
                  onMouseLeave={() => setHoverIdx(null)}
                >
                  <XAxis
                    dataKey="idx"
                    minTickGap={28}
                    tick={{ fontSize: 11, fill: "rgba(148,163,184,0.95)", pointerEvents: "none" }}
                    axisLine={{ stroke: "rgba(148,163,184,0.6)" }}
                    tickLine={false}
                    tickFormatter={xTickFormatter}
                  />
                  <YAxis
                    domain={([min, max]) => {
                      if (typeof min !== "number" || typeof max !== "number") return [min, max];
                      const span = max - min || Math.abs(max || 1);
                      return [min - span * 0.06, max + span * 0.2];
                    }}
                    tickFormatter={(v) =>
                      formatAxisNumber(typeof v === "number" ? v : Number(v))
                    }
                    tick={{ fontSize: 11, pointerEvents: "none" }}
                    width={56}
                  />
                  <Tooltip
                    content={
                      <PriceTooltip interval={interval} showMa20={showMa20} showMa50={showMa50} />
                    }
                    cursor={false}
                  />
                  {interval === "1D" && marketOpenIdx != null && marketOpenIdx > 0 && (
                    <ReferenceArea
                      x1={0}
                      x2={marketOpenIdx}
                      strokeOpacity={0}
                      fill="rgba(148,163,184,0.08)"
                    />
                  )}
                  {interval === "1D" && marketCloseIdx != null && marketCloseIdx < chartRows.length - 1 && (
                    <ReferenceArea
                      x1={marketCloseIdx}
                      x2={chartRows.length - 1}
                      strokeOpacity={0}
                      fill="rgba(148,163,184,0.08)"
                    />
                  )}
                  {interval === "1D" && marketOpenIdx != null && (
                    <ReferenceLine
                      x={marketOpenIdx}
                      stroke="rgba(148,163,184,0.9)"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      ifOverflow="extendDomain"
                    />
                  )}
                  {interval === "1D" && marketCloseIdx != null && (
                    <ReferenceLine
                      x={marketCloseIdx}
                      stroke="rgba(148,163,184,0.9)"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      ifOverflow="extendDomain"
                    />
                  )}
                  {!dragging && hoverIdx != null && (
                    <ReferenceLine
                      x={hoverIdx}
                      stroke="rgba(148,163,184,0.8)"
                      strokeDasharray="3 3"
                      ifOverflow="extendDomain"
                    />
                  )}
                  {selectedRange && (
                    <ReferenceArea
                      x1={selectedRange.left}
                      x2={selectedRange.right}
                      strokeOpacity={0}
                      fill="rgba(56,189,248,0.16)"
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="close"
                    name="Price"
                    stroke={isNegative ? "#f87171" : "#34d399"}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive
                    animationDuration={450}
                  />
                  {showMa20 ? (
                    <Line
                      type="monotone"
                      dataKey="ma20"
                      name="SMA 20"
                      stroke="#fbbf24"
                      strokeWidth={1.5}
                      strokeOpacity={0.92}
                      dot={false}
                      connectNulls
                      isAnimationActive
                      animationDuration={350}
                    />
                  ) : null}
                  {showMa50 ? (
                    <Line
                      type="monotone"
                      dataKey="ma50"
                      name="SMA 50"
                      stroke="#a78bfa"
                      strokeWidth={1.5}
                      strokeOpacity={0.92}
                      dot={false}
                      connectNulls
                      isAnimationActive
                      animationDuration={350}
                    />
                  ) : null}
                </LineChart>
              </ResponsiveContainer>
              </div>
            )}
            {openMarkerLeftPct != null && (
              <div
                className="pointer-events-none absolute top-2 -translate-x-1/2 rounded-full border border-(--card-border) bg-(--card)/95 px-2 py-0.5 text-[10px] text-(--muted) shadow-sm"
                style={{ left: `${openMarkerLeftPct}%` }}
              >
                9:30 AM
              </div>
            )}
            {closeMarkerLeftPct != null && (
              <div
                className="pointer-events-none absolute top-2 -translate-x-1/2 rounded-full border border-(--card-border) bg-(--card)/95 px-2 py-0.5 text-[10px] text-(--muted) shadow-sm"
                style={{ left: `${closeMarkerLeftPct}%` }}
              >
                4 PM
              </div>
            )}
          </div>

          <div className="mb-2 flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold">Metrics</h4>
            <button
              type="button"
              onClick={() => setEditingMetrics((v) => !v)}
              className="rounded-md border border-(--card-border) px-2 py-1 text-xs hover:bg-(--card)"
            >
              {editingMetrics ? "Done" : "Edit"}
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {metricOrder.map((id) => {
              if (id === "next_earnings") {
                return (
                  <MetricCard
                    key={id}
                    label="Next Earnings"
                    value={
                      data?.nextEarnings
                        ? `${formatEarningsDate(data.nextEarnings.at)}${data.nextEarnings.isEstimate ? " (est.)" : ""}`
                        : "—"
                    }
                    valueClassName="text-teal-400"
                    draggable={editingMetrics}
                    dragActive={dragMetricId === id}
                    onDragStart={() => setDragMetricId(id)}
                    onDragEnd={() => setDragMetricId(null)}
                    onDrop={() => {
                      if (editingMetrics && dragMetricId) moveMetric(dragMetricId, id);
                      setDragMetricId(null);
                    }}
                  />
                );
              }
              if (id === "range_52w") {
                return (
                  <MetricCard
                    key={id}
                    label="52 Week Range"
                    value={`${formatUsd(data?.metrics.week52Low)} - ${formatUsd(data?.metrics.week52High)}`}
                    draggable={editingMetrics}
                    dragActive={dragMetricId === id}
                    onDragStart={() => setDragMetricId(id)}
                    onDragEnd={() => setDragMetricId(null)}
                    onDrop={() => {
                      if (editingMetrics && dragMetricId) moveMetric(dragMetricId, id);
                      setDragMetricId(null);
                    }}
                    extra={
                      <div className="mt-2 h-2 rounded-full bg-(--card-border)">
                        <div className="relative h-2 rounded-full bg-sky-500/30" style={{ width: "100%" }}>
                          <span
                            className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border border-white/60 bg-emerald-300"
                            style={{ left: `calc(${rangePct ?? 0}% - 6px)` }}
                          />
                        </div>
                      </div>
                    }
                  />
                );
              }
              const valueMap: Record<Exclude<MetricId, "next_earnings" | "range_52w">, { label: string; value: string }> = {
                market_cap: { label: "Market Cap", value: formatMarketCap(data?.metrics.marketCap) },
                sector: { label: "Sector", value: data?.sector ?? "—" },
                industry: { label: "Industry", value: data?.industry ?? "—" },
                beta: { label: "Beta", value: formatNumber(data?.metrics.beta, 2) },
                pe: { label: "P/E", value: formatNumber(data?.metrics.trailingPE, 2) },
                forward_pe: { label: "Forward P/E", value: formatNumber(data?.metrics.forwardPE, 2) },
                peg: { label: "PEG Ratio", value: formatNumber(data?.metrics.pegRatio, 2) },
                price_book: { label: "Price/Book", value: formatNumber(data?.metrics.priceToBook, 2) },
                enterprise_value: { label: "Enterprise Value", value: formatMarketCap(data?.metrics.enterpriseValue) },
                ev_revenue: { label: "EV / Revenue", value: formatNumber(data?.metrics.enterpriseToRevenue, 2) },
                ev_ebitda: { label: "EV / EBITDA", value: formatNumber(data?.metrics.enterpriseToEbitda, 2) },
                profit_margin: { label: "Profit Margin", value: formatPct(data?.metrics.profitMargin) },
                roe: { label: "Return on Equity", value: formatPct(data?.metrics.returnOnEquity) },
                div_yield: {
                  label: "Dividend Yield",
                  value: data?.metrics.dividendYield == null ? "—" : `${formatNumber(data.metrics.dividendYield, 2)}%`,
                },
                eps_ttm: { label: "EPS (TTM)", value: formatNumber(data?.context.epsTrailingTwelveMonths, 2) },
                eps_fwd: { label: "EPS (Fwd)", value: formatNumber(data?.context.epsForward, 2) },
                annual_div: { label: "Annual Div / Sh", value: formatUsd(data?.context.trailingAnnualDividendRate) },
                chg_52w: {
                  label: "52W Chg",
                  value:
                    data?.context.fiftyTwoWeekChangePercent == null
                      ? "—"
                      : `${formatNumber(data.context.fiftyTwoWeekChangePercent, 2)}%`,
                },
                avg_50d: { label: "50D Avg", value: formatUsd(data?.context.fiftyDayAverage) },
                avg_200d: { label: "200D Avg", value: formatUsd(data?.context.twoHundredDayAverage) },
                vol_day: { label: "Vol (day)", value: formatNumber(data?.context.regularMarketVolume, 0) },
                vol_10d: { label: "Avg Vol (10D)", value: formatNumber(data?.context.avgVolume10Day, 0) },
                vol_3m: { label: "Avg Vol (3M)", value: formatNumber(data?.context.avgVolume3Month, 0) },
              };
              const row = valueMap[id as Exclude<MetricId, "next_earnings" | "range_52w">];
              return (
                <MetricCard
                  key={id}
                  label={row.label}
                  value={row.value}
                  draggable={editingMetrics}
                  dragActive={dragMetricId === id}
                  onDragStart={() => setDragMetricId(id)}
                  onDragEnd={() => setDragMetricId(null)}
                  onDrop={() => {
                    if (editingMetrics && dragMetricId) moveMetric(dragMetricId, id);
                    setDragMetricId(null);
                  }}
                />
              );
            })}
          </div>

          {/* ── Analyst Ratings + Price Targets ──────────────────────── */}
          <div className="rounded-xl border border-(--card-border) bg-(--background) p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-(--muted)">Analyst Ratings</p>
            {data?.analyst ? (
              <AnalystRatingBubbles analyst={data.analyst} />
            ) : (
              <p className="text-sm text-(--muted)">No analyst ratings available.</p>
            )}
            {data?.analystTargets && (data.analystTargets.targetLow != null || data.analystTargets.targetHigh != null) && (() => {
              const lo = data.analystTargets.targetLow;
              const hi = data.analystTargets.targetHigh;
              const avg = data.analystTargets.targetMean;
              const price = data.metrics.price;
              if (!lo || !hi || hi <= lo) return null;
              const pricePct = price != null ? Math.min(100, Math.max(0, ((price - lo) / (hi - lo)) * 100)) : null;
              const avgPct = avg != null ? Math.min(100, Math.max(0, ((avg - lo) / (hi - lo)) * 100)) : null;
              const upside = price != null && avg != null ? ((avg - price) / price) * 100 : null;
              return (
                <div className="mt-3 border-t border-(--card-border) pt-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-(--muted)">
                    Price Targets{data.analystTargets.numAnalysts ? ` · ${data.analystTargets.numAnalysts} analysts` : ""}
                  </p>
                  <div className="relative h-2 w-full rounded-full bg-slate-700/60">
                    {avgPct != null && (
                      <div className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-indigo-400" style={{ left: `${avgPct}%` }} />
                    )}
                    {pricePct != null && (
                      <div className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-cyan-400 shadow" style={{ left: `${pricePct}%` }} />
                    )}
                  </div>
                  <div className="mt-2 flex justify-between text-[10px] tabular-nums">
                    <span className="text-rose-400">↓ {lo != null ? formatUsd(lo) : "—"}</span>
                    <div className="text-center">
                      {avg != null && <span className="text-indigo-300">Avg {formatUsd(avg)}</span>}
                      {upside != null && (
                        <span className={"ml-1.5 font-semibold " + (upside >= 0 ? "text-emerald-400" : "text-rose-400")}>
                          ({upside >= 0 ? "+" : ""}{formatNumber(upside, 1)}%)
                        </span>
                      )}
                    </div>
                    <span className="text-emerald-400">↑ {hi != null ? formatUsd(hi) : "—"}</span>
                  </div>
                  <div className="mt-1 text-center text-[10px] text-(--muted)">
                    Current {price != null ? formatUsd(price) : "—"}
                    {data.analystTargets.recommendationKey && (
                      <span className="ml-2 font-medium capitalize text-indigo-300">· {data.analystTargets.recommendationKey.replace(/_/g, " ")}</span>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        <aside className="space-y-3">
          {/* Company description */}
          {data?.overview && (
            <div className="rounded-xl border border-(--card-border) bg-(--background) p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-(--muted)">About</p>
              <p className="text-sm leading-relaxed text-foreground/85">{data.overview}</p>
            </div>
          )}

          {/* News */}
          <div className="rounded-xl border border-(--card-border) bg-(--background) p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-(--muted)">News</p>
              <div className="flex items-center gap-1.5">
                <a
                  href={`https://x.com/search?q=%24${encodeURIComponent(symbol)}+%28filter%3Averified%29&f=live`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-(--card-border) px-2 py-0.5 text-[10px] font-medium text-sky-400 hover:bg-(--card)"
                >
                  𝕏 X
                </a>
                <button
                  type="button"
                  onClick={() => { setNewsOffset(0); setReloadToken((t) => t + 1); }}
                  className="rounded-md border border-(--card-border) px-2 py-0.5 text-[10px] hover:bg-(--card)"
                >
                  ↻
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {data?.news?.length ? (
                data.news.map((item) => (
                  <div key={item.id} className="rounded-lg border border-(--card-border) bg-(--card) px-3 py-2">
                    <a href={item.link} target="_blank" rel="noreferrer" className="text-xs underline-offset-2 hover:underline">
                      {item.title}
                    </a>
                    <p className="mt-0.5 text-[11px] text-(--muted)">
                      {item.publisher}
                      {item.publishedAt ? ` · ${new Date(item.publishedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-(--muted)">No recent news available.</p>
              )}
            </div>
            {data?.newsMeta?.hasMore && (
              <button
                type="button"
                onClick={() => setNewsOffset((o) => o + newsLimit)}
                className="mt-2 w-full rounded-md border border-(--card-border) px-2 py-1.5 text-[11px] hover:bg-(--card)"
              >
                Load more
              </button>
            )}
          </div>
        </aside>
      </div>
      <StockTrendsModal symbol={symbol} open={trendsOpen} onClose={() => setTrendsOpen(false)} />
    </div>
  );
}

function MetricCard({
  label,
  value,
  valueClassName,
  draggable,
  dragActive,
  onDragStart,
  onDragEnd,
  onDrop,
  extra,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  draggable?: boolean;
  dragActive?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDrop?: () => void;
  extra?: ReactNode;
}) {
  return (
    <div
      draggable={Boolean(draggable)}
      onDragStart={(e) => {
        if (!draggable) return;
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragEnd={() => onDragEnd?.()}
      onDragOver={(e) => {
        if (!draggable) return;
        e.preventDefault();
      }}
      onDrop={(e) => {
        if (!draggable) return;
        e.preventDefault();
        onDrop?.();
      }}
      className={
        "rounded-lg border border-(--card-border) bg-(--background) px-3 py-2 " +
        (draggable ? "cursor-grab" : "") +
        (dragActive ? " opacity-70 ring-2 ring-sky-400/60" : "")
      }
    >
      <p className="text-xs text-(--muted)">{label}</p>
      <p className={"text-sm font-medium " + (valueClassName ?? "")}>{value}</p>
      {extra}
    </div>
  );
}
