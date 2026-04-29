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
  reportTimeEt: string | null;
  logoUrl: string | null;
};

type ScreenerQuoteLike = Record<string, unknown>;

async function runWithConcurrency<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const next = queue.shift();
      if (!next) return;
      await fn(next);
    }
  });
  await Promise.all(workers);
}

function toNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}


function sessionFromMinutes(minutes: number | null, fallback: SessionType): SessionType {
  if (minutes == null) return fallback;
  if (minutes < 9 * 60 + 30) return "premarket";
  if (minutes >= 16 * 60) return "aftermarket";
  return "time-unknown";
}

function parseEtMinutesFromIso(iso: string | null): number | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "");
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function toEtTimeLabel(minutes: number | null): string | null {
  if (minutes == null) return null;
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = ((hour24 + 11) % 12) + 1;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix} ET`;
}

function isoFromUnixSeconds(v: unknown): string | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const d = new Date(v * 1000);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function toIsoFromUnknown(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? null : v.toISOString();
  }
  if (typeof v === "number") {
    const msCandidate = new Date(v);
    if (!Number.isNaN(msCandidate.getTime()) && v > 10_000_000_000) {
      return msCandidate.toISOString();
    }
    return isoFromUnixSeconds(v);
  }
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof v === "object" && v !== null) {
    const obj = v as Record<string, unknown>;
    if (typeof obj.fmt === "string") {
      const d = new Date(obj.fmt);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
    const raw = obj.raw;
    const fromRaw = toIsoFromUnknown(raw);
    if (fromRaw) return fromRaw;
  }
  return null;
}

function extractCalendarDateCandidates(qs: Record<string, unknown>): string[] {
  const cal = (qs.calendarEvents as Record<string, unknown> | undefined)?.earnings as
    | Record<string, unknown>
    | undefined;
  const raw = cal?.earningsDate;
  if (Array.isArray(raw)) {
    return raw.map(toIsoFromUnknown).filter((x): x is string => Boolean(x));
  }
  return [toIsoFromUnknown(raw)].filter((x): x is string => Boolean(x));
}

function logoFromWebsite(website: string | null): string | null {
  if (!website) return null;
  try {
    const host = new URL(website).hostname.replace(/^www\./, "");
    if (!host) return null;
    return `https://logo.clearbit.com/${host}`;
  } catch {
    return null;
  }
}

function withinWeek(iso: string | null, weekStart: Date | null, weekEnd: Date | null): boolean {
  if (!iso) return false;
  if (!weekStart || !weekEnd) return true;
  const at = new Date(iso).getTime();
  return at >= weekStart.getTime() && at <= weekEnd.getTime();
}

export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const weekStartParam = searchParams.get("weekStart");
  const weekEndParam = searchParams.get("weekEnd");
  const weekStart = weekStartParam ? new Date(weekStartParam) : null;
  const weekEnd = weekEndParam ? new Date(weekEndParam) : null;

  const symbols = [
    "AAPL","MSFT","NVDA","AMZN","GOOGL","META","TSLA","NFLX","AVGO","AMD","INTC","ORCL","CRM","ADBE","QCOM","TXN",
    "JPM","BAC","WFC","GS","MS","C","BLK","SCHW","AXP","V","MA","PYPL",
    "UNH","JNJ","PFE","MRK","LLY","ABBV","TMO","ABT","DHR","ISRG","BMY",
    "XOM","CVX","COP","SLB","EOG","OXY",
    "WMT","COST","HD","LOW","TGT","MCD","SBUX","NKE","DIS","CMCSA","UBER","ABNB",
    "BA","CAT","GE","HON","DE","MMM","LMT","RTX",
    "KO","PEP","PG","CL","KMB","GIS",
  ];

  const out: EarningsItem[] = [];
  const outBySymbol = new Map<string, EarningsItem>();
  let attempted = 0;
  let withAnyDate = 0;
  let inRequestedWeek = 0;
  await runWithConcurrency(symbols, 6, async (symbol) => {
      try {
        attempted += 1;
        const q = (await yahooFinance.quote(symbol)) as Record<string, unknown>;
        const qs = (await yahooFinance.quoteSummary(symbol, {
          modules: ["calendarEvents", "summaryProfile", "price"],
        })) as Record<string, unknown>;
        const profile = qs.summaryProfile as Record<string, unknown> | undefined;
        const price = qs.price as Record<string, unknown> | undefined;
        const website: string | null = typeof profile?.website === "string" ? profile.website : null;
        const shortName = String(
          price?.shortName ?? price?.longName ?? q.shortName ?? q.longName ?? symbol
        );

        const calDates = extractCalendarDateCandidates(qs);
        const earningsDateCandidates = [
          ...calDates,
          toIsoFromUnknown(q.earningsTimestamp),
          toIsoFromUnknown(q.earningsTimestampStart),
          toIsoFromUnknown(q.earningsTimestampEnd),
        ].filter((x): x is string => Boolean(x));
        if (earningsDateCandidates.length > 0) withAnyDate += 1;

        let earningsDate = earningsDateCandidates[0] ?? null;
        if (weekStart && weekEnd && earningsDateCandidates.length > 0) {
          const inWeek = earningsDateCandidates.find((iso) => {
            const at = new Date(iso).getTime();
            return at >= weekStart.getTime() && at <= weekEnd.getTime();
          });
          if (inWeek) earningsDate = inWeek;
        }
        if (!earningsDate) return;
        if (withinWeek(earningsDate, weekStart, weekEnd)) inRequestedWeek += 1;

        const epsEstimate = toNum(q.epsForward);
        const epsActual = toNum(q.epsCurrentYear);
        const epsBeat = epsActual != null && epsEstimate != null ? epsActual >= epsEstimate : null;
        const revenueEstimate = null;
        const revenueActual = null;
        const revenueBeat = revenueActual != null && revenueEstimate != null ? revenueActual >= revenueEstimate : null;

        const fallbackSession = "time-unknown" as SessionType;
        const minutesEt = parseEtMinutesFromIso(earningsDate);
        const session = sessionFromMinutes(minutesEt, fallbackSession);

        const row: EarningsItem = {
          symbol,
          shortName,
          earningsDate,
          session,
          website,
          earningsLink: `https://finance.yahoo.com/quote/${symbol}/earnings`,
          epsEstimate,
          epsActual,
          epsBeat,
          revenueEstimate,
          revenueActual,
          revenueBeat,
          reportTimeEt: toEtTimeLabel(minutesEt),
          logoUrl: logoFromWebsite(website),
        };
        outBySymbol.set(symbol, row);
      } catch {
        // Ignore per-symbol failures.
      }
    });

  // Secondary fallback: Yahoo screeners often include earnings timestamps even when quote paths do not.
  if (outBySymbol.size === 0) {
    const scrIds = ["day_gainers", "day_losers", "most_actives", "growth_technology_stocks"] as const;
    await runWithConcurrency([...scrIds], 2, async (scrId) => {
      try {
        const result = (await yahooFinance.screener({ scrIds: scrId, count: 250 })) as Record<string, unknown>;
        const quotes = Array.isArray(result.quotes) ? (result.quotes as ScreenerQuoteLike[]) : [];
        for (const q of quotes) {
          const symbol = String(q.symbol ?? "").toUpperCase().trim();
          if (!symbol || outBySymbol.has(symbol)) continue;
          const earningsDateCandidates = [
            toIsoFromUnknown(q.earningsTimestamp),
            toIsoFromUnknown(q.earningsTimestampStart),
            toIsoFromUnknown(q.earningsTimestampEnd),
            toIsoFromUnknown(q.earningsCallTimestampStart),
            toIsoFromUnknown(q.earningsCallTimestampEnd),
          ].filter((x): x is string => Boolean(x));
          const earningsDate =
            earningsDateCandidates.find((iso) => withinWeek(iso, weekStart, weekEnd)) ??
            earningsDateCandidates[0] ??
            null;
          if (!earningsDate) continue;
          const minutesEt = parseEtMinutesFromIso(earningsDate);
          const session = sessionFromMinutes(minutesEt, "time-unknown");
          outBySymbol.set(symbol, {
            symbol,
            shortName: String(q.shortName ?? q.longName ?? symbol),
            earningsDate,
            session,
            website: null,
            earningsLink: `https://finance.yahoo.com/quote/${symbol}/earnings`,
            epsEstimate: toNum(q.epsForward),
            epsActual: toNum(q.epsCurrentYear),
            epsBeat: null,
            revenueEstimate: null,
            revenueActual: null,
            revenueBeat: null,
            reportTimeEt: toEtTimeLabel(minutesEt),
            logoUrl: null,
          });
        }
      } catch {
        // ignore screener failures
      }
    });
  }

  out.push(...outBySymbol.values());

  out.sort((a, b) => {
    const at = a.earningsDate ? new Date(a.earningsDate).getTime() : Number.MAX_SAFE_INTEGER;
    const bt = b.earningsDate ? new Date(b.earningsDate).getTime() : Number.MAX_SAFE_INTEGER;
    return at - bt;
  });

  return NextResponse.json({
    items: out,
    meta: {
      attempted,
      withAnyDate,
      inRequestedWeek,
      returned: out.length,
      weekStart: weekStart?.toISOString() ?? null,
      weekEnd: weekEnd?.toISOString() ?? null,
    },
  });
}
