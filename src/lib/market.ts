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

type YahooSummaryResponse = {
  quoteSummary?: {
    result?: Array<{
      defaultKeyStatistics?: { sharesOutstanding?: { raw?: number } };
    }>;
  };
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

async function fetchYahooMarketCap(symbol: string): Promise<number | null> {
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
  if (!r?.marketCap || !Number.isFinite(r.marketCap)) return null;
  return Number(r.marketCap);
}

async function fetchYahooSharesOutstanding(symbol: string): Promise<number | null> {
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
    symbol
  )}?modules=defaultKeyStatistics`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "application/json,text/plain,*/*",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as YahooSummaryResponse;
  const raw =
    data.quoteSummary?.result?.[0]?.defaultKeyStatistics?.sharesOutstanding?.raw;
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return null;
  return Number(raw);
}

async function enrichMarketCap(symbol: string, price: number): Promise<number | null> {
  const directCap = await fetchYahooMarketCap(symbol).catch(() => null);
  if (directCap != null) return directCap;
  const sharesOutstanding = await fetchYahooSharesOutstanding(symbol).catch(() => null);
  if (sharesOutstanding == null) return null;
  return sharesOutstanding * price;
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

async function fetchStooqCsv(symbol: string): Promise<Quote | null> {
  const ticker = symbol.toLowerCase() + ".us";
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(ticker)}&i=d`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const text = await res.text();
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return null;
  const values = lines[1].split(",");
  if (values.length < 5) return null;
  const close = Number(values[4]?.replace(/"/g, ""));
  if (!Number.isFinite(close) || close <= 0) return null;
  return {
    symbol,
    name: symbol,
    price: close,
    marketCap: null,
    marketCapText: null,
  };
}

async function fetchYahooChart(symbol: string): Promise<Quote | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
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
    chart?: {
      result?: Array<{
        meta?: { symbol?: string; regularMarketPrice?: number };
      }>;
    };
  };
  const meta = data.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice;
  if (price == null || !Number.isFinite(price) || price <= 0) return null;
  return {
    symbol: meta?.symbol || symbol,
    name: meta?.symbol || symbol,
    price: Number(price),
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
    const yahooChart = await fetchYahooChart(symbol);
    if (yahooChart) {
      const cap = await enrichMarketCap(yahooChart.symbol, yahooChart.price).catch(
        () => null
      );
      if (cap != null) {
        return {
          ...yahooChart,
          marketCap: cap,
          marketCapText: formatMarketCap(cap),
        };
      }
      return yahooChart;
    }
  } catch {
    // Try fallback provider below.
  }

  try {
    const stooq = await fetchStooq(symbol);
    if (stooq) {
      const cap = await enrichMarketCap(stooq.symbol, stooq.price).catch(() => null);
      if (cap != null) {
        return {
          ...stooq,
          marketCap: cap,
          marketCapText: formatMarketCap(cap),
        };
      }
      return stooq;
    }
  } catch {
    // Ignore and throw a single clear error below.
  }

  try {
    const stooqCsv = await fetchStooqCsv(symbol);
    if (stooqCsv) {
      const cap = await enrichMarketCap(stooqCsv.symbol, stooqCsv.price).catch(
        () => null
      );
      if (cap != null) {
        return {
          ...stooqCsv,
          marketCap: cap,
          marketCapText: formatMarketCap(cap),
        };
      }
      return stooqCsv;
    }
  } catch {
    // Ignore and throw a single clear error below.
  }

  throw new Error("Could not load quote for that symbol right now.");
}
