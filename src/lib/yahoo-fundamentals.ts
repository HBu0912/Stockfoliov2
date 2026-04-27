import type { QuoteSummaryResult } from "yahoo-finance2/modules/quoteSummary";
import type { Quote } from "yahoo-finance2/modules/quote";

type Summary = QuoteSummaryResult;

export function n(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  return Number(v);
}

export function normalizeDividendYield(raw: number | null | undefined): number | null {
  if (raw == null || !Number.isFinite(raw)) return null;
  // Yahoo `quote` often returns percent points (e.g. 0.38), while quoteSummary uses decimals (e.g. 0.0038).
  if (raw > 1) return raw / 100;
  return raw;
}

export function mergeFundamentals(quote: Quote, summary: Summary) {
  const trailingPE =
    n(quote.trailingPE) ??
    n(summary.summaryDetail?.trailingPE) ??
    (() => {
      const price = n(quote.regularMarketPrice);
      const eps = n(quote.epsTrailingTwelveMonths);
      if (price == null || eps == null || eps === 0) return null;
      return price / eps;
    })();

  const forwardPE = n(quote.forwardPE) ?? n(summary.summaryDetail?.forwardPE);

  const pegRatio = n(quote.pegRatio) ?? n(summary.defaultKeyStatistics?.pegRatio);

  const priceToBook =
    n(quote.priceToBook) ??
    n(summary.defaultKeyStatistics?.priceToBook) ??
    (() => {
      const price = n(quote.regularMarketPrice);
      const bv = n(quote.bookValue);
      if (price == null || bv == null || bv === 0) return null;
      return price / bv;
    })();

  const profitMargin = n(quote.profitMargins) ?? n(summary.financialData?.profitMargins);

  const returnOnEquity = n(quote.returnOnEquity) ?? n(summary.financialData?.returnOnEquity);

  const dividendYield =
    normalizeDividendYield(quote.dividendYield as number | undefined) ??
    normalizeDividendYield(summary.summaryDetail?.dividendYield as number | undefined);

  const enterpriseValue = n(summary.defaultKeyStatistics?.enterpriseValue);
  const enterpriseToRevenue = n(summary.defaultKeyStatistics?.enterpriseToRevenue);
  const enterpriseToEbitda = n(summary.defaultKeyStatistics?.enterpriseToEbitda);

  return {
    beta: n(summary.defaultKeyStatistics?.beta ?? summary.summaryDetail?.beta),
    trailingPE,
    forwardPE,
    pegRatio,
    priceToBook,
    profitMargin,
    returnOnEquity,
    dividendYield,
    enterpriseValue,
    enterpriseToRevenue,
    enterpriseToEbitda,
  };
}
