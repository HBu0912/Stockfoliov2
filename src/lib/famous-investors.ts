export type InvestorHolding = {
  symbol: string;
  weightPct: number;
  notes?: string;
};

export type FamousInvestorProfile = {
  id: string;
  name: string;
  strategy: string;
  sourceLabel: string;
  sourceUrl: string;
  updatedAt: string;
  holdings: InvestorHolding[];
};

export const FAMOUS_INVESTORS: FamousInvestorProfile[] = [
  {
    id: "warren-buffett",
    name: "Warren Buffett (Berkshire Hathaway)",
    strategy: "Long-term value investing with concentrated positions.",
    sourceLabel: "WhaleWisdom Berkshire 13F",
    sourceUrl: "https://whalewisdom.com/filer/berkshire-hathaway-inc",
    updatedAt: "2026-03-31",
    holdings: [
      { symbol: "AAPL", weightPct: 28.4 },
      { symbol: "AXP", weightPct: 14.2 },
      { symbol: "BAC", weightPct: 11.5 },
      { symbol: "KO", weightPct: 9.1 },
      { symbol: "CVX", weightPct: 7.8 },
      { symbol: "OXY", weightPct: 5.4 },
      { symbol: "MCO", weightPct: 4.1 },
      { symbol: "KHC", weightPct: 3.4 },
      { symbol: "DVA", weightPct: 2.8 },
      { symbol: "V", weightPct: 2.6 },
    ],
  },
  {
    id: "nancy-pelosi",
    name: "Nancy Pelosi (Reported Trades Proxy)",
    strategy: "Congressional disclosure-based basket of top reported names.",
    sourceLabel: "Quiver Quantitative congressional tracker",
    sourceUrl: "https://www.quiverquant.com/congresstrading/politician/Nancy%20Pelosi-P000197",
    updatedAt: "2026-03-31",
    holdings: [
      { symbol: "NVDA", weightPct: 20.0 },
      { symbol: "AAPL", weightPct: 12.0 },
      { symbol: "MSFT", weightPct: 10.0 },
      { symbol: "GOOGL", weightPct: 9.0 },
      { symbol: "AMZN", weightPct: 9.0 },
      { symbol: "PANW", weightPct: 8.0 },
      { symbol: "AVGO", weightPct: 8.0 },
      { symbol: "CRM", weightPct: 7.0 },
      { symbol: "TSLA", weightPct: 9.0 },
      { symbol: "NFLX", weightPct: 8.0 },
    ],
  },
  {
    id: "michael-burry",
    name: "Michael Burry (Scion Asset Management)",
    strategy: "Event-driven, high-conviction, tactical allocations.",
    sourceLabel: "WhaleWisdom Scion 13F",
    sourceUrl: "https://whalewisdom.com/filer/scion-asset-management-llc",
    updatedAt: "2026-03-31",
    holdings: [
      { symbol: "BABA", weightPct: 17.0 },
      { symbol: "JD", weightPct: 14.0 },
      { symbol: "GOOGL", weightPct: 12.0 },
      { symbol: "BKNG", weightPct: 11.0 },
      { symbol: "CVS", weightPct: 10.0 },
      { symbol: "C", weightPct: 9.0 },
      { symbol: "WBD", weightPct: 8.0 },
      { symbol: "DIS", weightPct: 7.0 },
      { symbol: "VFC", weightPct: 6.0 },
      { symbol: "ORCL", weightPct: 6.0 },
    ],
  },
];
