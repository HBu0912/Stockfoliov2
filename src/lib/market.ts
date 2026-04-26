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

/**
 * Fetches a live quote (price + name + market cap) from Yahoo Finance public endpoints.
 * May fail if rate-limited; callers should show the error to the user.
 */
export async function fetchQuote(rawSymbol: string): Promise<Quote> {
  const symbol = rawSymbol.trim().toUpperCase();
  if (!symbol) throw new Error("Symbol is required");
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error("Could not load quote. Try again later.");
  const data = (await res.json()) as { quoteResponse?: { result?: YahooResult[]; error?: unknown } };
  const r = data.quoteResponse?.result?.[0];
  if (!r || r.regularMarketPrice == null) throw new Error("Symbol not found or no price data.");
  const name = (r.longName as string) || (r.shortName as string) || symbol;
  const cap = r.marketCap != null && Number.isFinite(r.marketCap) ? (r.marketCap as number) : null;
  return {
    symbol: (r.symbol as string) || symbol,
    name,
    price: Number(r.regularMarketPrice),
    marketCap: cap,
    marketCapText: cap != null ? formatMarketCap(cap) : null,
  };
}
