import { formatMarketCap } from "./money";

export type Quote = {
  symbol: string;
  name: string;
  price: number;
  marketCap: number | null;
  marketCapText: string | null;
};

type YahooResult = {
  symbol?: string;
  longName?: string;
  shortName?: string;
  regularMarketPrice?: number;
  marketCap?: number;
};

type StooqRow = {
  Symbol?: string;
  Close?: string;
};

async function fetchYahoo(symbol: string): Promise<Quote | null> {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "application/json,text/plain,*/*",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    quoteResponse?: { result?: YahooResult[] };
  };
  const r = data.quoteResponse?.result?.[0];
  if (!r || r.regularMarketPrice == null) return null;
  const name = r.longName || r.shortName || symbol;
  const cap =
    r.marketCap != null && Number.isFinite(r.marketCap) ? r.marketCap : null;
  return {
    symbol: r.symbol || symbol,
    name,
    price: Number(r.regularMarketPrice),
    marketCap: cap,
    marketCapText: cap != null ? formatMarketCap(cap) : null,
  };
}

async function fetchStooq(symbol: string): Promise<Quote | null> {
  // Fallback when Yahoo blocks requests in serverless regions.
  const ticker = symbol.toLowerCase() + ".us";
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(ticker)}&f=sd2t2ohlcvn&h&e=json`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as { symbols?: StooqRow[] };
  const row = data.symbols?.[0];
  if (!row?.Close) return null;
  const price = Number(row.Close);
  if (!Number.isFinite(price) || price <= 0) return null;
  return {
    symbol,
    name: symbol,
    price,
    marketCap: null,
    marketCapText: null,
  };
}

export async function fetchQuote(rawSymbol: string): Promise<Quote> {
  const symbol = rawSymbol.trim().toUpperCase();
  if (!symbol) throw new Error("Symbol is required");

  try {
    const yahoo = await fetchYahoo(symbol);
    if (yahoo) return yahoo;
  } catch {
    // Try fallback provider below.
  }

  try {
    const stooq = await fetchStooq(symbol);
    if (stooq) return stooq;
  } catch {
    // Ignore and throw a single clear error below.
  }

  throw new Error("Could not load quote for that symbol right now.");
}
