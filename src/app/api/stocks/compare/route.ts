import { NextResponse } from "next/server";
import { fetchQuote } from "@/lib/market";

type RawField = { raw?: number | null } | null | undefined;

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

type YahooSummaryResponse = {
  quoteSummary?: {
    result?: Array<{
      defaultKeyStatistics?: {
        beta?: RawField;
        pegRatio?: RawField;
        priceToBook?: RawField;
      };
      summaryDetail?: {
        beta?: RawField;
        trailingPE?: RawField;
        forwardPE?: RawField;
        dividendYield?: RawField;
      };
      financialData?: {
        profitMargins?: RawField;
        returnOnEquity?: RawField;
      };
    }>;
  };
};

function toNumber(field: RawField): number | null {
  const value = field?.raw;
  if (value == null || !Number.isFinite(value)) return null;
  return Number(value);
}

async function fetchFundamentals(symbol: string): Promise<Fundamentals> {
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
    symbol
  )}?modules=defaultKeyStatistics,summaryDetail,financialData`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "application/json,text/plain,*/*",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Could not load fundamentals.");
  }
  const data = (await res.json()) as YahooSummaryResponse;
  const row = data.quoteSummary?.result?.[0];
  return {
    beta: toNumber(row?.defaultKeyStatistics?.beta) ?? toNumber(row?.summaryDetail?.beta),
    trailingPE: toNumber(row?.summaryDetail?.trailingPE),
    forwardPE: toNumber(row?.summaryDetail?.forwardPE),
    pegRatio: toNumber(row?.defaultKeyStatistics?.pegRatio),
    priceToBook: toNumber(row?.defaultKeyStatistics?.priceToBook),
    profitMargin: toNumber(row?.financialData?.profitMargins),
    returnOnEquity: toNumber(row?.financialData?.returnOnEquity),
    dividendYield: toNumber(row?.summaryDetail?.dividendYield),
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
