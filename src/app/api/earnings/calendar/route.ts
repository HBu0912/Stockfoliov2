import { getSession } from "@/lib/auth";
import yahooFinance from "yahoo-finance2";
import { NextResponse } from "next/server";

type SessionType = "premarket" | "aftermarket" | "time-unknown";

type EarningsItem = {
  symbol: string;
  shortName: string;
  earningsDate: string | null;
  session: SessionType;
  website: string | null;
  earningsLink: string;
  epsEstimate: number | null;
  epsActual: number | null;
  epsBeat: boolean | null;
  revenueEstimate: number | null;
  revenueActual: number | null;
  revenueBeat: boolean | null;
};

type LooseObject = Record<string, unknown>;

function toNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function sessionFromCallTime(v: unknown): SessionType {
  const s = String(v ?? "").toLowerCase();
  if (s.includes("bmo") || s.includes("pre")) return "premarket";
  if (s.includes("amc") || s.includes("post")) return "aftermarket";
  return "time-unknown";
}

function asObject(v: unknown): LooseObject {
  return v && typeof v === "object" ? (v as LooseObject) : {};
}

function pick(v: unknown, key: string): unknown {
  return asObject(v)[key];
}

export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const rawSymbols = (searchParams.get("symbols") ?? "")
    .split(",")
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean);
  const fallback = ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "JPM", "NFLX", "AVGO"];
  const symbols = [...new Set((rawSymbols.length ? rawSymbols : fallback).slice(0, 20))];

  const out: EarningsItem[] = [];
  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const qs = await yahooFinance.quoteSummary(symbol, {
          modules: ["calendarEvents", "summaryProfile", "price", "earningsHistory", "earningsTrend", "incomeStatementHistoryQuarterly"],
        });

        const cal = asObject(pick(pick(qs, "calendarEvents"), "earnings"));
        const earningsDateRaw = pick(cal, "earningsDate");
        const dateObj = Array.isArray(earningsDateRaw) ? earningsDateRaw[0] : earningsDateRaw;
        const earningsDate = dateObj ? new Date(dateObj).toISOString() : null;

        const history = pick(pick(qs, "earningsHistory"), "history");
        const hist = Array.isArray(history) ? asObject(history[0]) : {};
        const epsEstimate = toNum(pick(hist, "epsEstimate") ?? pick(cal, "epsEstimate"));
        const epsActual = toNum(pick(hist, "epsActual"));
        const epsBeat = epsActual != null && epsEstimate != null ? epsActual >= epsEstimate : null;

        const trendRows = pick(pick(qs, "earningsTrend"), "trend");
        const trend = Array.isArray(trendRows) ? asObject(trendRows[0]) : {};
        const revenueEstimate = toNum(pick(asObject(pick(trend, "revenueEstimate")), "avg"));
        const incomeRows = pick(pick(qs, "incomeStatementHistoryQuarterly"), "incomeStatementHistory");
        const income = Array.isArray(incomeRows) ? asObject(incomeRows[0]) : {};
        const totalRevenue = pick(income, "totalRevenue");
        const revenueActual = toNum(pick(asObject(totalRevenue), "raw") ?? totalRevenue);
        const revenueBeat = revenueActual != null && revenueEstimate != null ? revenueActual >= revenueEstimate : null;

        out.push({
          symbol,
          shortName: String(pick(pick(qs, "price"), "shortName") ?? symbol),
          earningsDate,
          session: sessionFromCallTime(pick(cal, "earningsCallTime")),
          website: pick(pick(qs, "summaryProfile"), "website") as string | null,
          earningsLink: `https://finance.yahoo.com/quote/${symbol}/earnings`,
          epsEstimate,
          epsActual,
          epsBeat,
          revenueEstimate,
          revenueActual,
          revenueBeat,
        });
      } catch {
        // Ignore per-symbol failures.
      }
    })
  );

  out.sort((a, b) => {
    const at = a.earningsDate ? new Date(a.earningsDate).getTime() : Number.MAX_SAFE_INTEGER;
    const bt = b.earningsDate ? new Date(b.earningsDate).getTime() : Number.MAX_SAFE_INTEGER;
    return at - bt;
  });

  return NextResponse.json({ items: out });
}
