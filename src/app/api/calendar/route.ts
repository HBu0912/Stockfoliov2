import { getSession } from "@/lib/auth";
import { NextResponse } from "next/server";

type NasdaqRow = {
  symbol?: string;
  name?: string;
  time?: string;
  marketCap?: string;
  epsForecast?: string;
  lastYearEPS?: string;
  fiscalQuarterEnding?: string;
};

type CalendarItem = {
  symbol: string;
  name: string;
  earningsDate: string;
  reportTime: "Morning" | "Night" | "N/A";
  marketCap: string | null;
  epsForecast: string | null;
};

const NASDAQ_HEADERS: Record<string, string> = {
  accept: "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9",
  "cache-control": "no-cache",
  origin: "https://www.nasdaq.com",
  pragma: "no-cache",
  referer: "https://www.nasdaq.com/market-activity/earnings",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

function toDateParam(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseMarketCap(marketCap: string | null | undefined): number {
  if (!marketCap) return 0;
  const cleaned = marketCap.replace(/[$,\s]/g, "").toUpperCase();
  const match = cleaned.match(/^([0-9]*\.?[0-9]+)([KMBT])?$/);
  if (!match) return 0;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return 0;
  const suffix = match[2] ?? "";
  const multiplier =
    suffix === "T" ? 1_000_000_000_000 : suffix === "B" ? 1_000_000_000 : suffix === "M" ? 1_000_000 : suffix === "K" ? 1_000 : 1;
  return value * multiplier;
}

function normalizeTime(raw: string | undefined): "Morning" | "Night" | "N/A" {
  if (!raw) return "N/A";
  const v = raw.toLowerCase();
  if (v.includes("before") || v.includes("pre-market") || v.includes("premarket") || v.includes("time-pre-market")) {
    return "Morning";
  }
  if (v.includes("after") || v.includes("post-market") || v.includes("after-hours") || v.includes("time-after-hours")) {
    return "Night";
  }
  return "N/A";
}

async function fetchNasdaqDay(dateParam: string): Promise<NasdaqRow[]> {
  const url = `https://api.nasdaq.com/api/calendar/earnings?date=${dateParam}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const res = await fetch(url, { headers: NASDAQ_HEADERS, cache: "no-store", signal: controller.signal }).finally(
    () => clearTimeout(timeout)
  );
  if (!res.ok) return [];
  const json = (await res.json()) as {
    data?: {
      rows?: NasdaqRow[];
    };
  };
  return Array.isArray(json.data?.rows) ? json.data.rows : [];
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date") ?? toDateParam(new Date());
  const offset = Math.max(0, Number(searchParams.get("offset") ?? 0));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 20)));

  let failedDates = 0;
  const dedupe = new Set<string>();
  const items: CalendarItem[] = [];

  try {
    const rows = await fetchNasdaqDay(dateParam);
    for (const row of rows) {
      const symbol = (row.symbol ?? "").trim().toUpperCase();
      if (!symbol) continue;
      if (dedupe.has(symbol)) continue;
      dedupe.add(symbol);
      items.push({
        symbol,
        name: row.name?.trim() || symbol,
        earningsDate: dateParam,
        reportTime: normalizeTime(row.time),
        marketCap: row.marketCap ?? null,
        epsForecast: row.epsForecast ?? null,
      });
    }
  } catch {
    failedDates = 1;
  }

  items.sort((a, b) => {
    const capDiff = parseMarketCap(b.marketCap) - parseMarketCap(a.marketCap);
    if (capDiff !== 0) return capDiff;
    return a.symbol.localeCompare(b.symbol);
  });

  const pagedItems = items.slice(offset, offset + limit);

  return NextResponse.json({
    items: pagedItems,
    meta: {
      date: dateParam,
      scannedDates: 1,
      failedDates,
      returned: pagedItems.length,
      total: items.length,
      offset,
      limit,
      hasMore: offset + pagedItems.length < items.length,
    },
  });
}
