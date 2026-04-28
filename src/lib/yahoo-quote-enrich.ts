import YahooFinance from "yahoo-finance2";
import { formatMarketCap } from "@/lib/money";
import { fetchQuote, type Quote } from "@/lib/market";

const yahoo = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

function n(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  return Number(v);
}

/**
 * `fetchQuote` is optimized for price reliability across providers.
 * For fundamentals like market cap, Yahoo's `quote` endpoint is usually the most complete.
 */
export async function fetchQuoteWithYahooMarketData(rawSymbol: string): Promise<Quote> {
  const base = await fetchQuote(rawSymbol);
  const sym = base.symbol;
  try {
    const q = await yahoo.quote(sym);
    const cap = n(q.marketCap) ?? base.marketCap;
    return {
      ...base,
      name: q.longName ?? q.shortName ?? q.displayName ?? base.name,
      marketCap: cap,
      marketCapText: cap != null ? formatMarketCap(cap) : base.marketCapText,
    };
  } catch {
    return base;
  }
}
