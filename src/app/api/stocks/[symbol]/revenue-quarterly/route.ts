import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { prisma } from "@/lib/prisma";

const yahoo = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

type QuarterPoint = {
  at: number;
  label: string;
  revenue: number | null;
  grossMarginPct: number | null;
  operatingMarginPct: number | null;
  netMarginPct: number | null;
  ebitdaMarginPct: number | null;
  cogsPctRevenue: number | null;
  sgaPctRevenue: number | null;
  rdPctRevenue: number | null;
  capex: number | null;
  operatingCashFlow: number | null;
  freeCashFlow: number | null;
  fcfMarginPct: number | null;
  debt: number | null;
  netDebtToEbitda: number | null;
  cashAndEquivalents: number | null;
  roePct: number | null;
  roicPct: number | null;
  roaPct: number | null;
  epsDiluted: number | null;
  shareCount: number | null;
  bookValuePerShare: number | null;
  fcfPerShare: number | null;
};

function toMillis(dateVal: unknown): number | null {
  let ms: number | null = null;
  if (dateVal instanceof Date && !Number.isNaN(dateVal.getTime())) ms = dateVal.getTime();
  else if (typeof dateVal === "number" && Number.isFinite(dateVal)) {
    ms = dateVal < 1e12 ? dateVal * 1000 : dateVal;
  } else if (typeof dateVal === "string") {
    const d = new Date(dateVal);
    ms = Number.isNaN(d.getTime()) ? null : d.getTime();
  }
  if (ms == null) return null;
  // Normalize to UTC midnight so sources that differ by hours still map to the same quarter key
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function n(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

function pick(row: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = n(row[k]);
    if (v != null) return v;
  }
  return null;
}

function pct(numerator: number | null, denominator: number | null): number | null {
  if (numerator == null || denominator == null || denominator === 0) return null;
  return (numerator / denominator) * 100;
}

function growth(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function mergeQuarterPoints(live: QuarterPoint, cached: QuarterPoint): QuarterPoint {
  const pick = <T extends number | null>(l: T, c: T) => (l != null ? l : c);
  return {
    at: live.at,
    label: live.label,
    revenue: pick(live.revenue, cached.revenue),
    grossMarginPct: pick(live.grossMarginPct, cached.grossMarginPct),
    operatingMarginPct: pick(live.operatingMarginPct, cached.operatingMarginPct),
    netMarginPct: pick(live.netMarginPct, cached.netMarginPct),
    ebitdaMarginPct: pick(live.ebitdaMarginPct, cached.ebitdaMarginPct),
    cogsPctRevenue: pick(live.cogsPctRevenue, cached.cogsPctRevenue),
    sgaPctRevenue: pick(live.sgaPctRevenue, cached.sgaPctRevenue),
    rdPctRevenue: pick(live.rdPctRevenue, cached.rdPctRevenue),
    capex: pick(live.capex, cached.capex),
    operatingCashFlow: pick(live.operatingCashFlow, cached.operatingCashFlow),
    freeCashFlow: pick(live.freeCashFlow, cached.freeCashFlow),
    fcfMarginPct: pick(live.fcfMarginPct, cached.fcfMarginPct),
    debt: pick(live.debt, cached.debt),
    netDebtToEbitda: pick(live.netDebtToEbitda, cached.netDebtToEbitda),
    cashAndEquivalents: pick(live.cashAndEquivalents, cached.cashAndEquivalents),
    roePct: pick(live.roePct, cached.roePct),
    roicPct: pick(live.roicPct, cached.roicPct),
    roaPct: pick(live.roaPct, cached.roaPct),
    epsDiluted: pick(live.epsDiluted, cached.epsDiluted),
    shareCount: pick(live.shareCount, cached.shareCount),
    bookValuePerShare: pick(live.bookValuePerShare, cached.bookValuePerShare),
    fcfPerShare: pick(live.fcfPerShare, cached.fcfPerShare),
  };
}

/** Drop legacy fields (e.g. extras / YoY) from cached JSON so merges stay stable. */
function quarterFromCache(raw: unknown): QuarterPoint {
  const o = raw as Record<string, unknown>;
  return {
    at: Number(o.at),
    label: String(o.label ?? ""),
    revenue: n(o.revenue),
    grossMarginPct: n(o.grossMarginPct),
    operatingMarginPct: n(o.operatingMarginPct),
    netMarginPct: n(o.netMarginPct),
    ebitdaMarginPct: n(o.ebitdaMarginPct),
    cogsPctRevenue: n(o.cogsPctRevenue),
    sgaPctRevenue: n(o.sgaPctRevenue),
    rdPctRevenue: n(o.rdPctRevenue),
    capex: n(o.capex),
    operatingCashFlow: n(o.operatingCashFlow),
    freeCashFlow: n(o.freeCashFlow),
    fcfMarginPct: n(o.fcfMarginPct),
    debt: n(o.debt),
    netDebtToEbitda: n(o.netDebtToEbitda),
    cashAndEquivalents: n(o.cashAndEquivalents),
    roePct: n(o.roePct),
    roicPct: n(o.roicPct),
    roaPct: n(o.roaPct),
    epsDiluted: n(o.epsDiluted),
    shareCount: n(o.shareCount),
    bookValuePerShare: n(o.bookValuePerShare),
    fcfPerShare: n(o.fcfPerShare),
  };
}

async function persistTrendSnapshots(symbol: string, rows: unknown[]) {
  await Promise.all(
    rows.map((row) => {
      const r = row as { at: number };
      return prisma.trendsQuarterSnapshot.upsert({
        where: { symbol_atMs: { symbol, atMs: BigInt(r.at) } },
        create: { symbol, atMs: BigInt(r.at), data: row as object },
        update: { data: row as object },
      });
    }),
  );
}

export async function GET(_req: Request, ctx: { params: Promise<{ symbol: string }> }) {
  const { symbol: rawSymbol } = await ctx.params;
  const symbol = rawSymbol.trim().toUpperCase();
  if (!symbol) return NextResponse.json({ error: "Symbol is required." }, { status: 400 });

  try {
    const period2 = new Date();
    const period1 = new Date(period2);
    period1.setFullYear(period1.getFullYear() - 6);

    const [financialRows, allRows, summary] = await Promise.all([
      yahoo.fundamentalsTimeSeries(symbol, {
        period1: period1.toISOString().slice(0, 10),
        period2: period2.toISOString().slice(0, 10),
        type: "quarterly",
        module: "financials",
      }) as Promise<Array<Record<string, unknown>>>,
      yahoo.fundamentalsTimeSeries(symbol, {
        period1: period1.toISOString().slice(0, 10),
        period2: period2.toISOString().slice(0, 10),
        type: "quarterly",
        module: "all",
      }).catch(() => [] as Array<Record<string, unknown>>),
      // quoteSummary financial history is often updated within hours of earnings; use it
      // as a supplementary source for the most recent quarters
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (yahoo.quoteSummary as any)(symbol, {
        modules: [
          "incomeStatementHistoryQuarterly",
          "cashflowStatementHistoryQuarterly",
          "balanceSheetHistoryQuarterly",
          "earningsHistory",
        ],
      }).catch(() => null) as Promise<Record<string, unknown> | null>,
    ]);

    // Flatten quoteSummary quarterly statements into the same row format
    const summaryRows: Array<Record<string, unknown>> = [];
    if (summary) {
      const incomeQ = (summary as Record<string, { statements?: unknown[] } | null | undefined>)
        .incomeStatementHistoryQuarterly?.statements ?? [];
      const cashQ = (summary as Record<string, { cashflowStatements?: unknown[] } | null | undefined>)
        .cashflowStatementHistoryQuarterly?.cashflowStatements ?? [];
      const bsQ = (summary as Record<string, { statements?: unknown[] } | null | undefined>)
        .balanceSheetHistoryQuarterly?.statements ?? [];
      const epsQ = (summary as Record<string, { history?: unknown[] } | null | undefined>)
        .earningsHistory?.history ?? [];

      // Map by endDate so we can merge income + cashflow + balance sheet per quarter
      const byDate = new Map<number, Record<string, unknown>>();
      for (const row of [...incomeQ, ...cashQ, ...bsQ]) {
        const r = row as Record<string, unknown>;
        const ms = toMillis(r.endDate ?? r.date ?? r.period);
        if (ms == null) continue;
        const existing = byDate.get(ms) ?? {};
        // Flatten: unwrap {raw, fmt} objects
        const flat: Record<string, unknown> = { date: new Date(ms), periodType: "3M" };
        for (const [k, v] of Object.entries(r)) {
          if (v && typeof v === "object" && "raw" in (v as Record<string, unknown>)) {
            flat[k] = (v as Record<string, unknown>).raw;
          } else if (k !== "endDate" && k !== "date" && k !== "period" && k !== "maxAge") {
            flat[k] = v;
          }
        }
        byDate.set(ms, { ...existing, ...flat });
      }
      // EPS from earningsHistory
      for (const row of epsQ) {
        const r = row as Record<string, unknown>;
        const ms = toMillis((r.quarter as Record<string, unknown>)?.raw ?? r.quarter);
        if (ms == null) continue;
        const eps = n(typeof r.epsActual === "object" && r.epsActual !== null
          ? (r.epsActual as Record<string, unknown>).raw
          : r.epsActual);
        const existing = byDate.get(ms) ?? {};
        if (eps != null) byDate.set(ms, { ...existing, date: new Date(ms), periodType: "3M", dilutedEPS: eps });
      }
      summaryRows.push(...byDate.values());
    }

    // summaryRows (quoteSummary) comes FIRST so it has highest priority in pickVal merges —
    // it updates within hours of earnings, while fundamentalsTimeSeries can lag by days.
    // fundamentalsTimeSeries still fills in older history that quoteSummary doesn't cover.
    const rows = [...summaryRows, ...financialRows, ...allRows] as Array<Record<string, unknown>>;

    const mergedByDate = new Map<number, QuarterPoint>();
    for (const row of rows) {
      const periodType = String(row.periodType ?? "").toUpperCase();
      if (periodType && !periodType.includes("3M") && !periodType.includes("Q")) continue;
      const ms = toMillis(row.date);
      if (ms == null) continue;

      const revenue = pick(row, ["totalRevenue", "operatingRevenue"]);
      const grossProfit = pick(row, ["grossProfit"]);
      const operatingIncome = pick(row, ["operatingIncome"]);
      const netIncome = pick(row, ["netIncome"]);
      const ebitda = pick(row, ["ebitda"]);
      const cogs = pick(row, ["costOfRevenue"]);
      const sga = pick(row, [
        "sellingGeneralAndAdministration",
        "sellingAndMarketingExpense",
        "generalAndAdministrativeExpense",
      ]);
      const rd = pick(row, ["researchAndDevelopment"]);
      const capexRaw = pick(row, ["capitalExpenditure"]);
      const capex = capexRaw == null ? null : Math.abs(capexRaw);
      const operatingCashFlow = pick(row, ["operatingCashFlow"]);
      const freeCashFlow = pick(row, ["freeCashFlow"]);
      const debt = pick(row, ["totalDebt"]);
      const cashAndEquivalents = pick(row, [
        "cashAndCashEquivalents",
        "cashCashEquivalentsAndShortTermInvestments",
      ]);
      const equity = pick(row, ["totalEquityGrossMinorityInterest", "stockholdersEquity"]);
      const totalAssets = pick(row, ["totalAssets"]);
      const investedCapital = debt != null || equity != null || cashAndEquivalents != null
        ? (debt ?? 0) + (equity ?? 0) - (cashAndEquivalents ?? 0)
        : null;
      const shareCount = pick(row, [
        "dilutedAverageShares",
        "basicAverageShares",
        "ordinarySharesNumber",
        "shareIssued",
      ]);
      const epsDiluted = pick(row, ["dilutedEPS"]);
      const bookValuePerShare = equity != null && shareCount && shareCount > 0 ? equity / shareCount : null;
      const fcfPerShare = freeCashFlow != null && shareCount && shareCount > 0 ? freeCashFlow / shareCount : null;

      const next: QuarterPoint = {
        at: ms,
        label: new Intl.DateTimeFormat("en-US", {
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        }).format(new Date(ms)),
        revenue,
        grossMarginPct: pct(grossProfit, revenue),
        operatingMarginPct: pct(operatingIncome, revenue),
        netMarginPct: pct(netIncome, revenue),
        ebitdaMarginPct: pct(ebitda, revenue),
        cogsPctRevenue: pct(cogs, revenue),
        sgaPctRevenue: pct(sga, revenue),
        rdPctRevenue: pct(rd, revenue),
        capex,
        operatingCashFlow,
        freeCashFlow,
        fcfMarginPct: pct(freeCashFlow, revenue),
        debt,
        netDebtToEbitda:
          debt != null && cashAndEquivalents != null && ebitda != null && ebitda !== 0
            ? (debt - cashAndEquivalents) / ebitda
            : null,
        cashAndEquivalents,
        roePct: pct(netIncome, equity),
        roicPct: pct(netIncome, investedCapital),
        roaPct: pct(netIncome, totalAssets),
        epsDiluted,
        shareCount,
        bookValuePerShare,
        fcfPerShare,
      };

      const prev = mergedByDate.get(ms);
      if (!prev) {
        mergedByDate.set(ms, next);
      } else {
        const pickVal = <T extends number | null>(a: T, b: T) => (a != null ? a : b);
        mergedByDate.set(ms, {
          ...prev,
          ...next,
          revenue: pickVal(prev.revenue, next.revenue),
          grossMarginPct: pickVal(prev.grossMarginPct, next.grossMarginPct),
          operatingMarginPct: pickVal(prev.operatingMarginPct, next.operatingMarginPct),
          netMarginPct: pickVal(prev.netMarginPct, next.netMarginPct),
          ebitdaMarginPct: pickVal(prev.ebitdaMarginPct, next.ebitdaMarginPct),
          cogsPctRevenue: pickVal(prev.cogsPctRevenue, next.cogsPctRevenue),
          sgaPctRevenue: pickVal(prev.sgaPctRevenue, next.sgaPctRevenue),
          rdPctRevenue: pickVal(prev.rdPctRevenue, next.rdPctRevenue),
          capex: pickVal(prev.capex, next.capex),
          operatingCashFlow: pickVal(prev.operatingCashFlow, next.operatingCashFlow),
          freeCashFlow: pickVal(prev.freeCashFlow, next.freeCashFlow),
          fcfMarginPct: pickVal(prev.fcfMarginPct, next.fcfMarginPct),
          debt: pickVal(prev.debt, next.debt),
          netDebtToEbitda: pickVal(prev.netDebtToEbitda, next.netDebtToEbitda),
          cashAndEquivalents: pickVal(prev.cashAndEquivalents, next.cashAndEquivalents),
          roePct: pickVal(prev.roePct, next.roePct),
          roicPct: pickVal(prev.roicPct, next.roicPct),
          roaPct: pickVal(prev.roaPct, next.roaPct),
          epsDiluted: pickVal(prev.epsDiluted, next.epsDiluted),
          shareCount: pickVal(prev.shareCount, next.shareCount),
          bookValuePerShare: pickVal(prev.bookValuePerShare, next.bookValuePerShare),
          fcfPerShare: pickVal(prev.fcfPerShare, next.fcfPerShare),
        });
      }
    }

    let snapshots: Awaited<ReturnType<typeof prisma.trendsQuarterSnapshot.findMany>> = [];
    try {
      snapshots = await prisma.trendsQuarterSnapshot.findMany({ where: { symbol } });
    } catch {
      snapshots = [];
    }

    // For the 2 most recent live quarters, always trust live data over cache so
    // freshly-reported earnings (like SOFI March 2026) are never masked by a stale snapshot.
    const liveDates = [...mergedByDate.keys()].sort((a, b) => b - a);
    const recentLiveDates = new Set(liveDates.slice(0, 2));

    const mergedByDateFinal = new Map<number, QuarterPoint>(mergedByDate);
    for (const snap of snapshots) {
      const at = Number(snap.atMs);
      if (recentLiveDates.has(at)) continue; // always use live for recent quarters
      const cached = quarterFromCache(snap.data);
      const live = mergedByDateFinal.get(at);
      if (!live) {
        mergedByDateFinal.set(at, {
          ...cached,
          at,
          label:
            cached.label ||
            new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(
              new Date(at),
            ),
        });
      } else {
        mergedByDateFinal.set(at, mergeQuarterPoints(live, cached));
      }
    }

    const points = [...mergedByDateFinal.values()]
      .filter((x): x is QuarterPoint => x != null)
      .sort((a, b) => a.at - b.at);

    const quarters = points.slice(-24);

    const withGrowth = quarters.map((p, i) => {
      const prev = i > 0 ? quarters[i - 1]! : null;
      return {
        ...p,
        revenueQoqPct: growth(p.revenue, prev?.revenue ?? null),
        grossMarginQoqPct: growth(p.grossMarginPct, prev?.grossMarginPct ?? null),
        operatingMarginQoqPct: growth(p.operatingMarginPct, prev?.operatingMarginPct ?? null),
        netMarginQoqPct: growth(p.netMarginPct, prev?.netMarginPct ?? null),
        ebitdaMarginQoqPct: growth(p.ebitdaMarginPct, prev?.ebitdaMarginPct ?? null),
        cogsQoqPct: growth(p.cogsPctRevenue, prev?.cogsPctRevenue ?? null),
        sgaQoqPct: growth(p.sgaPctRevenue, prev?.sgaPctRevenue ?? null),
        rdQoqPct: growth(p.rdPctRevenue, prev?.rdPctRevenue ?? null),
        capexQoqPct: growth(p.capex, prev?.capex ?? null),
        ocfQoqPct: growth(p.operatingCashFlow, prev?.operatingCashFlow ?? null),
        fcfQoqPct: growth(p.freeCashFlow, prev?.freeCashFlow ?? null),
        fcfMarginQoqPct: growth(p.fcfMarginPct, prev?.fcfMarginPct ?? null),
        debtQoqPct: growth(p.debt, prev?.debt ?? null),
        netDebtToEbitdaQoqPct: growth(p.netDebtToEbitda, prev?.netDebtToEbitda ?? null),
        cashQoqPct: growth(p.cashAndEquivalents, prev?.cashAndEquivalents ?? null),
        roeQoqPct: growth(p.roePct, prev?.roePct ?? null),
        roicQoqPct: growth(p.roicPct, prev?.roicPct ?? null),
        roaQoqPct: growth(p.roaPct, prev?.roaPct ?? null),
        epsQoqPct: growth(p.epsDiluted, prev?.epsDiluted ?? null),
        sharesQoqPct: growth(p.shareCount, prev?.shareCount ?? null),
        bvpsQoqPct: growth(p.bookValuePerShare, prev?.bookValuePerShare ?? null),
        fcfPerShareQoqPct: growth(p.fcfPerShare, prev?.fcfPerShare ?? null),
      };
    });

    void persistTrendSnapshots(symbol, withGrowth).catch(() => {
      // non-fatal
    });

    return NextResponse.json({ symbol, quarters: withGrowth });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not load revenue series.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
