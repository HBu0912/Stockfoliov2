import { NextResponse } from "next/server";
import { fetchQuote } from "@/lib/market";
import YahooFinance from "yahoo-finance2";

type Fundamentals = {
  beta: number | null;
  trailingPE: number | null;
  forwardPE: number | null;
  pegRatio: number | null;
  priceToBook: number | null;
  profitMargin: number | null;
  returnOnEquity: number | null;
  dividendYield: number | null;
};

const yahoo = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

function toNumber(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Number(value);
}

async function fetchFundamentals(symbol: string): Promise<Fundamentals> {
  const summary = await yahoo.quoteSummary(symbol, {
    modules: ["summaryDetail", "defaultKeyStatistics", "financialData"],
  });

  return {
    beta: toNumber(summary.defaultKeyStatistics?.beta ?? summary.summaryDetail?.beta),
    trailingPE: toNumber(summary.summaryDetail?.trailingPE),
    forwardPE: toNumber(summary.summaryDetail?.forwardPE),
    pegRatio: toNumber(summary.defaultKeyStatistics?.pegRatio),
    priceToBook: toNumber(summary.defaultKeyStatistics?.priceToBook),
    profitMargin: toNumber(summary.financialData?.profitMargins),
    returnOnEquity: toNumber(summary.financialData?.returnOnEquity),
    dividendYield: toNumber(summary.summaryDetail?.dividendYield),
  };
}

async function fetchComparisonRow(symbol: string) {
  const quotePromise = fetchQuote(symbol);
  const fundamentalsPromise = fetchFundamentals(symbol).catch(() => ({
    beta: null,
    trailingPE: null,
    forwardPE: null,
    pegRatio: null,
    priceToBook: null,
    profitMargin: null,
    returnOnEquity: null,
    dividendYield: null,
  }));

  const [quote, fundamentals] = await Promise.all([quotePromise, fundamentalsPromise]);
  return {
    symbol: quote.symbol,
    name: quote.name,
    price: quote.price,
    marketCap: quote.marketCap,
    marketCapText: quote.marketCapText,
    ...fundamentals,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbolsParam = searchParams.get("symbols") ?? "";
  const symbols = [...new Set(symbolsParam.split(",").map((s) => s.trim().toUpperCase()))].filter(
    Boolean
  );

  if (symbols.length < 2 || symbols.length > 3) {
    return NextResponse.json(
      { error: "Please provide 2-3 ticker symbols (comma-separated)." },
      { status: 400 }
    );
  }

  try {
    const rows = await Promise.all(symbols.map((symbol) => fetchComparisonRow(symbol)));
    return NextResponse.json({ stocks: rows });
  } catch {
    return NextResponse.json(
      { error: "Could not load one or more symbols right now." },
      { status: 502 }
    );
  }
}
