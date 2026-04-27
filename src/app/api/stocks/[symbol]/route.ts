import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { formatMarketCap } from "@/lib/money";

const yahoo = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const intervals = ["1D", "1W", "1M", "3M", "YTD", "1Y", "5Y", "ALL"] as const;
type IntervalKey = (typeof intervals)[number];

function isIntervalKey(v: string): v is IntervalKey {
  return intervals.includes(v as IntervalKey);
}

function chartWindow(interval: IntervalKey, firstTradeDate: Date | null) {
  const now = new Date();
  const ytdStart = new Date(now.getFullYear(), 0, 1);
  const day = 24 * 60 * 60 * 1000;
  if (interval === "1D") {
    return { period1: new Date(now.getTime() - day), period2: now, chartInterval: "5m" as const };
  }
  if (interval === "1W") {
    return { period1: new Date(now.getTime() - 7 * day), period2: now, chartInterval: "30m" as const };
  }
  if (interval === "1M") {
    return { period1: new Date(now.getTime() - 30 * day), period2: now, chartInterval: "1d" as const };
  }
  if (interval === "3M") {
    return { period1: new Date(now.getTime() - 90 * day), period2: now, chartInterval: "1d" as const };
  }
  if (interval === "YTD") {
    return { period1: ytdStart, period2: now, chartInterval: "1d" as const };
  }
  if (interval === "1Y") {
    return { period1: new Date(now.getTime() - 365 * day), period2: now, chartInterval: "1d" as const };
  }
  if (interval === "5Y") {
    return { period1: new Date(now.getTime() - 365 * 5 * day), period2: now, chartInterval: "1mo" as const };
  }
  return {
    period1: firstTradeDate ?? new Date(now.getTime() - 365 * 30 * day),
    period2: now,
    chartInterval: "1mo" as const,
  };
}

function n(v: number | null | undefined): number | null {
  return v == null || !Number.isFinite(v) ? null : Number(v);
}

export async function GET(req: Request, ctx: { params: Promise<{ symbol: string }> }) {
  const { symbol: rawSymbol } = await ctx.params;
  const symbol = rawSymbol.trim().toUpperCase();
  if (!symbol) return NextResponse.json({ error: "Symbol is required." }, { status: 400 });

  const u = new URL(req.url);
  const intervalRaw = (u.searchParams.get("interval") ?? "1M").toUpperCase();
  const interval: IntervalKey = isIntervalKey(intervalRaw) ? intervalRaw : "1M";

  try {
    const quote = await yahoo.quote(symbol);
    const firstTradeDate = quote.firstTradeDateMilliseconds
      ? new Date(quote.firstTradeDateMilliseconds)
      : null;
    const { period1, period2, chartInterval } = chartWindow(interval, firstTradeDate);

    const [summary, chart, search] = await Promise.all([
      yahoo.quoteSummary(symbol, {
        modules: [
          "summaryDetail",
          "defaultKeyStatistics",
          "financialData",
          "summaryProfile",
          "recommendationTrend",
        ],
      }),
      yahoo.chart(symbol, { period1, period2, interval: chartInterval }),
      yahoo.search(symbol, { quotesCount: 0, newsCount: 8 }).catch(() => null),
    ]);

    const points =
      chart.quotes
        ?.filter((q) => q.date && q.close != null)
        .map((q) => ({
          at: q.date.toISOString(),
          close: Number(q.close),
        })) ?? [];

    const current = n(quote.regularMarketPrice) ?? n(quote.postMarketPrice) ?? n(quote.preMarketPrice);
    const low52 = n(quote.fiftyTwoWeekLow);
    const high52 = n(quote.fiftyTwoWeekHigh);
    const first = points[0]?.close;
    const last = points[points.length - 1]?.close;
    const changePct =
      first != null && last != null && first !== 0 ? ((last - first) / first) * 100 : null;

    return NextResponse.json({
      symbol,
      name: quote.longName ?? quote.shortName ?? quote.displayName ?? symbol,
      interval,
      chart: points,
      changePct,
      sector: summary.summaryProfile?.sector ?? null,
      overview: summary.summaryProfile?.longBusinessSummary ?? null,
      analyst: summary.recommendationTrend?.trend?.[0]
        ? {
            strongBuy: summary.recommendationTrend.trend[0].strongBuy ?? 0,
            buy: summary.recommendationTrend.trend[0].buy ?? 0,
            hold: summary.recommendationTrend.trend[0].hold ?? 0,
            sell: summary.recommendationTrend.trend[0].sell ?? 0,
            strongSell: summary.recommendationTrend.trend[0].strongSell ?? 0,
          }
        : null,
      news:
        search?.news?.map((item) => ({
          id: item.uuid,
          title: item.title,
          publisher: item.publisher,
          link: item.link,
          publishedAt: item.providerPublishTime?.toISOString() ?? null,
        })) ?? [],
      metrics: {
        price: current,
        marketCap: n(quote.marketCap),
        marketCapText: quote.marketCap != null ? formatMarketCap(quote.marketCap) : null,
        beta: n(summary.defaultKeyStatistics?.beta ?? summary.summaryDetail?.beta),
        trailingPE: n(summary.summaryDetail?.trailingPE),
        forwardPE: n(summary.summaryDetail?.forwardPE),
        pegRatio: n(summary.defaultKeyStatistics?.pegRatio),
        priceToBook: n(summary.defaultKeyStatistics?.priceToBook),
        profitMargin: n(summary.financialData?.profitMargins),
        returnOnEquity: n(summary.financialData?.returnOnEquity),
        dividendYield: n(summary.summaryDetail?.dividendYield),
        week52Low: low52,
        week52High: high52,
      },
    });
  } catch {
    return NextResponse.json({ error: "Could not load stock analysis right now." }, { status: 502 });
  }
}
