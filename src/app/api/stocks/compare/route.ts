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

type YahooQuoteResult = {
  beta?: number;
  trailingPE?: number;
  forwardPE?: number;
  pegRatio?: number;
  priceToBook?: number;
  profitMargins?: number;
  returnOnEquity?: number;
  dividendYield?: number;
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

type SummaryRow = NonNullable<
  NonNullable<YahooSummaryResponse["quoteSummary"]>["result"]
>[number];

type YahooQuoteResponse = {
  quoteResponse?: {
    result?: YahooQuoteResult[];
  };
};

function toNumber(field: RawField): number | null {
  const value = field?.raw;
  if (value == null || !Number.isFinite(value)) return null;
  return Number(value);
}

async function fetchFundamentals(symbol: string): Promise<Fundamentals> {
  const quoteUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(
    symbol
  )}`;
  const quoteRes = await fetch(quoteUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "application/json,text/plain,*/*",
    },
    cache: "no-store",
  });

  let quoteRow: YahooQuoteResult | undefined;
  if (quoteRes.ok) {
    const quoteData = (await quoteRes.json()) as YahooQuoteResponse;
    quoteRow = quoteData.quoteResponse?.result?.[0];
  }

  const summaryUrls = [
    `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
      symbol
    )}?modules=defaultKeyStatistics,summaryDetail,financialData`,
    `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
      symbol
    )}?modules=defaultKeyStatistics,summaryDetail,financialData`,
  ];

  let row: SummaryRow | undefined;

  for (const url of summaryUrls) {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json,text/plain,*/*",
      },
      cache: "no-store",
    });
    if (!res.ok) continue;
    const data = (await res.json()) as YahooSummaryResponse;
    row = data.quoteSummary?.result?.[0];
    if (row) break;
  }

  return {
    beta:
      toNumber(row?.defaultKeyStatistics?.beta) ??
      toNumber(row?.summaryDetail?.beta) ??
      (quoteRow?.beta != null && Number.isFinite(quoteRow.beta) ? quoteRow.beta : null),
    trailingPE:
      toNumber(row?.summaryDetail?.trailingPE) ??
      (quoteRow?.trailingPE != null && Number.isFinite(quoteRow.trailingPE)
        ? quoteRow.trailingPE
        : null),
    forwardPE:
      toNumber(row?.summaryDetail?.forwardPE) ??
      (quoteRow?.forwardPE != null && Number.isFinite(quoteRow.forwardPE)
        ? quoteRow.forwardPE
        : null),
    pegRatio:
      toNumber(row?.defaultKeyStatistics?.pegRatio) ??
      (quoteRow?.pegRatio != null && Number.isFinite(quoteRow.pegRatio) ? quoteRow.pegRatio : null),
    priceToBook:
      toNumber(row?.defaultKeyStatistics?.priceToBook) ??
      (quoteRow?.priceToBook != null && Number.isFinite(quoteRow.priceToBook)
        ? quoteRow.priceToBook
        : null),
    profitMargin:
      toNumber(row?.financialData?.profitMargins) ??
      (quoteRow?.profitMargins != null && Number.isFinite(quoteRow.profitMargins)
        ? quoteRow.profitMargins
        : null),
    returnOnEquity:
      toNumber(row?.financialData?.returnOnEquity) ??
      (quoteRow?.returnOnEquity != null && Number.isFinite(quoteRow.returnOnEquity)
        ? quoteRow.returnOnEquity
        : null),
    dividendYield:
      toNumber(row?.summaryDetail?.dividendYield) ??
      (quoteRow?.dividendYield != null && Number.isFinite(quoteRow.dividendYield)
        ? quoteRow.dividendYield
        : null),
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
