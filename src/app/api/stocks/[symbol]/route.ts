import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { formatMarketCap } from "@/lib/money";
import { mergeFundamentals, n } from "@/lib/yahoo-fundamentals";

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

export async function GET(req: Request, ctx: { params: Promise<{ symbol: string }> }) {
  const { symbol: rawSymbol } = await ctx.params;
  const symbol = rawSymbol.trim().toUpperCase();
  if (!symbol) return NextResponse.json({ error: "Symbol is required." }, { status: 400 });

  const u = new URL(req.url);
  const intervalRaw = (u.searchParams.get("interval") ?? "1M").toUpperCase();
  const interval: IntervalKey = isIntervalKey(intervalRaw) ? intervalRaw : "1M";
  const newsLimitRaw = Number(u.searchParams.get("newsLimit") ?? "5");
  const newsOffsetRaw = Number(u.searchParams.get("newsOffset") ?? "0");
  const newsLimit = Number.isFinite(newsLimitRaw) ? Math.min(20, Math.max(1, newsLimitRaw)) : 5;
  const newsOffset = Number.isFinite(newsOffsetRaw) ? Math.max(0, newsOffsetRaw) : 0;

  try {
    const quote = await yahoo.quote(symbol);
    const firstTradeDate = quote.firstTradeDateMilliseconds
      ? new Date(quote.firstTradeDateMilliseconds)
      : null;
    const { period1, period2, chartInterval } = chartWindow(interval, firstTradeDate);

    const newsFetchCount = Math.min(50, newsOffset + newsLimit);

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
      yahoo.search(symbol, { quotesCount: 0, newsCount: newsFetchCount }).catch(() => null),
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

    const fundamentals = mergeFundamentals(quote, summary);

    return NextResponse.json({
      symbol,
      name: quote.longName ?? quote.shortName ?? quote.displayName ?? symbol,
      interval,
      chart: points,
      changePct,
      sector: summary.summaryProfile?.sector ?? null,
      industry: summary.summaryProfile?.industry ?? null,
      exchange: quote.fullExchangeName ?? quote.exchange ?? null,
      currency: quote.currency ?? null,
      marketState: quote.marketState ?? null,
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
        search?.news
          ?.slice(newsOffset, newsOffset + newsLimit)
          .map((item) => ({
          id: item.uuid,
          title: item.title,
          publisher: item.publisher,
          link: item.link,
          publishedAt: item.providerPublishTime?.toISOString() ?? null,
          })) ?? [],
      newsMeta: {
        limit: newsLimit,
        offset: newsOffset,
        returned: search?.news?.slice(newsOffset, newsOffset + newsLimit).length ?? 0,
        totalAvailable: search?.news?.length ?? 0,
        fetched: newsFetchCount,
      },
      context: {
        avgVolume10Day: n(quote.averageDailyVolume10Day),
        avgVolume3Month: n(quote.averageDailyVolume3Month),
        regularMarketVolume: n(quote.regularMarketVolume),
        fiftyDayAverage: n(quote.fiftyDayAverage),
        twoHundredDayAverage: n(quote.twoHundredDayAverage),
        fiftyTwoWeekChangePercent: n(quote.fiftyTwoWeekChangePercent),
        trailingAnnualDividendRate: n(quote.trailingAnnualDividendRate),
        epsTrailingTwelveMonths: n(quote.epsTrailingTwelveMonths),
        epsForward: n(quote.epsForward),
      },
      metrics: {
        price: current,
        marketCap: n(quote.marketCap),
        marketCapText: quote.marketCap != null ? formatMarketCap(quote.marketCap) : null,
        beta: fundamentals.beta,
        trailingPE: fundamentals.trailingPE,
        forwardPE: fundamentals.forwardPE,
        pegRatio: fundamentals.pegRatio,
        priceToBook: fundamentals.priceToBook,
        profitMargin: fundamentals.profitMargin,
        returnOnEquity: fundamentals.returnOnEquity,
        dividendYield: fundamentals.dividendYield,
        enterpriseValue: fundamentals.enterpriseValue,
        enterpriseToRevenue: fundamentals.enterpriseToRevenue,
        enterpriseToEbitda: fundamentals.enterpriseToEbitda,
        week52Low: low52,
        week52High: high52,
      },
    });
  } catch {
    return NextResponse.json({ error: "Could not load stock analysis right now." }, { status: 502 });
  }
}
