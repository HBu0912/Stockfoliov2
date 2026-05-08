import type { QuoteSummaryResult } from "yahoo-finance2/modules/quoteSummary";
import type { Quote } from "yahoo-finance2/modules/quote";

type Summary = QuoteSummaryResult;

export function n(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  return Number(v);
}

/**
 * Normalize Yahoo dividend yield into **percentage points for UI** (e.g. 1.18 → display as 1.18%).
 * Sources mix formats: decimal fraction (0.0118), already-percent (1.18), or rare small percents (0.38%).
 */
export function normalizeDividendYield(raw: number | null | undefined): number | null {
  if (raw == null || !Number.isFinite(raw)) return null;
  const x = Number(raw);
  if (x <= 0) return null;
  // Already-percent form.
  if (x >= 1) return x <= 30 ? x : null;
  // For sub-1 values Yahoo can be inconsistent (0.0118 decimal, or 0.38 as 0.38%).
  // Avoid exploding moderate values (e.g. 0.22 -> 22%) without corroboration.
  if (x < 0.05) return x * 100; // 0.0118 -> 1.18%
  return x; // 0.22 -> 0.22%
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

  const impliedDividendYield = (() => {
    const price = n(quote.regularMarketPrice);
    const dividendRate =
      n(quote.trailingAnnualDividendRate) ??
      n(summary.summaryDetail?.dividendRate);
    if (price == null || dividendRate == null || price <= 0 || dividendRate <= 0) return null;
    const pct = (dividendRate / price) * 100;
    return Number.isFinite(pct) && pct > 0 && pct <= 30 ? pct : null;
  })();

  const rawDividendYield =
    normalizeDividendYield(quote.dividendYield as number | undefined) ??
    normalizeDividendYield(summary.summaryDetail?.dividendYield as number | undefined);

  const dividendYield = (() => {
    if (impliedDividendYield != null) return impliedDividendYield;
    if (rawDividendYield == null) return null;
    return rawDividendYield <= 30 ? rawDividendYield : null;
  })();

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
