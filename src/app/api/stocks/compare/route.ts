import { NextResponse } from "next/server";
import { fetchQuote } from "@/lib/market";
import YahooFinance from "yahoo-finance2";
import { mergeFundamentals } from "@/lib/yahoo-fundamentals";

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

type Identity = {
  name: string | null;
  marketCap: number | null;
};

const yahoo = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

function toNumber(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Number(value);
}

async function fetchFundamentals(symbol: string): Promise<Fundamentals> {
  const [quote, summary] = await Promise.all([
    yahoo.quote(symbol),
    yahoo.quoteSummary(symbol, {
      modules: ["summaryDetail", "defaultKeyStatistics", "financialData"],
    }),
  ]);

  const merged = mergeFundamentals(quote, summary);

  return {
    beta: merged.beta,
    trailingPE: merged.trailingPE,
    forwardPE: merged.forwardPE,
    pegRatio: merged.pegRatio,
    priceToBook: merged.priceToBook,
    profitMargin: merged.profitMargin,
    returnOnEquity: merged.returnOnEquity,
    dividendYield: merged.dividendYield,
  };
}

async function fetchIdentity(symbol: string): Promise<Identity> {
  const q = await yahoo.quote(symbol);
  return {
    name: q.longName ?? q.shortName ?? q.displayName ?? null,
    marketCap: toNumber(q.marketCap),
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
  const identityPromise = fetchIdentity(symbol).catch(() => ({
    name: null,
    marketCap: null,
  }));

  const [quote, fundamentals, identity] = await Promise.all([
    quotePromise,
    fundamentalsPromise,
    identityPromise,
  ]);

  const marketCap = quote.marketCap ?? identity.marketCap;
  const name =
    quote.name && quote.name.toUpperCase() !== quote.symbol.toUpperCase()
      ? quote.name
      : identity.name ?? quote.name;

  return {
    symbol: quote.symbol,
    name,
    price: quote.price,
    marketCap,
    marketCapText: quote.marketCapText ?? null,
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
