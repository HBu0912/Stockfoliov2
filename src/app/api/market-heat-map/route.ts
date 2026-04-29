import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

type IntervalKey = "1D" | "1W" | "1M" | "3M" | "YTD" | "1Y" | "5Y" | "ALL";

type Row = {
  symbol: string;
  name: string;
  sector: string;
  marketCap: number;
  changePct: number;
};

const yahoo = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const SYMBOLS = [
  "AAPL","MSFT","NVDA","AMZN","GOOGL","META","TSLA","NFLX","AVGO","AMD","INTC","ORCL","CRM","ADBE","QCOM","TXN",
  "JPM","BAC","WFC","GS","MS","C","BLK","SCHW","AXP","V","MA","PYPL",
  "UNH","JNJ","PFE","MRK","LLY","ABBV","TMO","ABT","DHR","ISRG","BMY",
  "XOM","CVX","COP","SLB","EOG","OXY",
  "WMT","COST","HD","LOW","TGT","MCD","SBUX","NKE","DIS","CMCSA","UBER","ABNB","GRAB",
  "BA","CAT","GE","HON","DE","MMM","LMT","RTX",
  "KO","PEP","PG","CL","KMB","GIS",
];

function chartStart(interval: IntervalKey, now: Date): Date {
  const day = 24 * 60 * 60 * 1000;
  if (interval === "1W") return new Date(now.getTime() - 7 * day);
  if (interval === "1M") return new Date(now.getTime() - 31 * day);
  if (interval === "3M") return new Date(now.getTime() - 92 * day);
  if (interval === "YTD") return new Date(now.getFullYear(), 0, 1);
  if (interval === "1Y") return new Date(now.getTime() - 366 * day);
  if (interval === "5Y") return new Date(now.getTime() - 5 * 366 * day);
  if (interval === "ALL") return new Date(now.getTime() - 15 * 366 * day);
  return new Date(now.getTime() - day);
}

function toPct(start: number, end: number): number {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start === 0) return 0;
  return ((end - start) / start) * 100;
}

async function getChangePct(symbol: string, interval: IntervalKey): Promise<number | null> {
  if (interval === "1D") {
    const q = await yahoo.quote(symbol);
    const pct = q.regularMarketChangePercent;
    return typeof pct === "number" && Number.isFinite(pct) ? pct : null;
  }
  const now = new Date();
  const chart = await yahoo.chart(symbol, {
    period1: chartStart(interval, now),
    period2: now,
    interval: "1d",
  });
  const closes = (chart.quotes ?? [])
    .map((q) => q.close)
    .filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  if (closes.length < 2) return null;
  return toPct(closes[0], closes[closes.length - 1]);
}

async function getRow(symbol: string, interval: IntervalKey): Promise<Row | null> {
  try {
    const [quote, summary, changePct] = await Promise.all([
      yahoo.quote(symbol),
      yahoo.quoteSummary(symbol, { modules: ["summaryProfile", "price"] }),
      getChangePct(symbol, interval),
    ]);
    const marketCap = quote.marketCap;
    if (typeof marketCap !== "number" || !Number.isFinite(marketCap) || marketCap <= 0) return null;
    const sector =
      (summary.summaryProfile as { sector?: string } | undefined)?.sector ??
      "Other";
    return {
      symbol,
      name: quote.shortName ?? quote.longName ?? symbol,
      sector,
      marketCap,
      changePct: changePct ?? 0,
    };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const interval = (searchParams.get("interval") ?? "1D").toUpperCase() as IntervalKey;
  const valid: IntervalKey[] = ["1D", "1W", "1M", "3M", "YTD", "1Y", "5Y", "ALL"];
  const selected = valid.includes(interval) ? interval : "1D";

  const rows = await Promise.all(SYMBOLS.map((s) => getRow(s, selected)));
  const data = rows.filter((x): x is Row => Boolean(x));
  return NextResponse.json({ interval: selected, items: data });
}
