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
};

type LooseObject = Record<string, unknown>;

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

function sessionFromCallTime(v: unknown): SessionType {
  const s = String(v ?? "").toLowerCase();
  if (s.includes("bmo") || s.includes("pre")) return "premarket";
  if (s.includes("amc") || s.includes("post")) return "aftermarket";
  return "time-unknown";
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

function toIsoOrNull(v: unknown): string | null {
  if (!v) return null;
  const d = new Date(v as string | number | Date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
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
  await runWithConcurrency(symbols, 6, async (symbol) => {
      try {
        const qs = await yahooFinance.quoteSummary(symbol, {
          modules: ["calendarEvents", "summaryProfile", "price", "earningsHistory", "earningsTrend"],
        });

        const cal = asObject(pick(pick(qs, "calendarEvents"), "earnings"));
        const earningsDateRaw = pick(cal, "earningsDate");
        const earningsDateCandidates = Array.isArray(earningsDateRaw)
          ? earningsDateRaw.map(toIsoOrNull).filter((x): x is string => Boolean(x))
          : [toIsoOrNull(earningsDateRaw)].filter((x): x is string => Boolean(x));

        let earningsDate = earningsDateCandidates[0] ?? null;
        if (weekStart && weekEnd && earningsDateCandidates.length > 0) {
          const inWeek = earningsDateCandidates.find((iso) => {
            const at = new Date(iso).getTime();
            return at >= weekStart.getTime() && at <= weekEnd.getTime();
          });
          if (inWeek) earningsDate = inWeek;
        }
        if (weekStart && weekEnd && earningsDate) {
          const at = new Date(earningsDate).getTime();
          if (at < weekStart.getTime() || at > weekEnd.getTime()) return;
        }

        const history = pick(pick(qs, "earningsHistory"), "history");
        const hist = Array.isArray(history) ? asObject(history[0]) : {};
        const epsEstimate = toNum(pick(hist, "epsEstimate") ?? pick(cal, "epsEstimate"));
        const epsActual = toNum(pick(hist, "epsActual"));
        const epsBeat = epsActual != null && epsEstimate != null ? epsActual >= epsEstimate : null;

        const trendRows = pick(pick(qs, "earningsTrend"), "trend");
        const trend = Array.isArray(trendRows) ? asObject(trendRows[0]) : {};
        const revenueEstimate = toNum(pick(asObject(pick(trend, "revenueEstimate")), "avg"));
        const revenueActual = null;
        const revenueBeat = revenueActual != null && revenueEstimate != null ? revenueActual >= revenueEstimate : null;

        const fallbackSession = sessionFromCallTime(pick(cal, "earningsCallTime"));
        const minutesEt = parseEtMinutesFromIso(earningsDate);
        const session = sessionFromMinutes(minutesEt, fallbackSession);

        out.push({
          symbol,
          shortName: String(pick(pick(qs, "price"), "shortName") ?? symbol),
          earningsDate,
          session,
          website: pick(pick(qs, "summaryProfile"), "website") as string | null,
          earningsLink: `https://finance.yahoo.com/quote/${symbol}/earnings`,
          epsEstimate,
          epsActual,
          epsBeat,
          revenueEstimate,
          revenueActual,
          revenueBeat,
          reportTimeEt: toEtTimeLabel(minutesEt),
        });
      } catch {
        // Ignore per-symbol failures.
      }
    });

  out.sort((a, b) => {
    const at = a.earningsDate ? new Date(a.earningsDate).getTime() : Number.MAX_SAFE_INTEGER;
    const bt = b.earningsDate ? new Date(b.earningsDate).getTime() : Number.MAX_SAFE_INTEGER;
    return at - bt;
  });

  return NextResponse.json({ items: out });
}
