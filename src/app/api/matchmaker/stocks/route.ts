import { NextResponse } from "next/server";

type StyleTag = "growth" | "value" | "dividend" | "blend";
type CapTier = "mega" | "large" | "mid" | "small";

type UniverseEntry = {
  symbol: string;
  sector: string;
  capTier: CapTier;
  style: StyleTag[];
};

const UNIVERSE: UniverseEntry[] = [
  // Technology
  { symbol: "AAPL", sector: "Technology", capTier: "mega", style: ["growth", "blend"] },
  { symbol: "MSFT", sector: "Technology", capTier: "mega", style: ["growth"] },
  { symbol: "NVDA", sector: "Technology", capTier: "mega", style: ["growth"] },
  { symbol: "AVGO", sector: "Technology", capTier: "mega", style: ["growth", "dividend"] },
  { symbol: "ORCL", sector: "Technology", capTier: "large", style: ["growth", "blend"] },
  { symbol: "CRM", sector: "Technology", capTier: "large", style: ["growth"] },
  { symbol: "ADBE", sector: "Technology", capTier: "large", style: ["growth"] },
  { symbol: "QCOM", sector: "Technology", capTier: "large", style: ["blend", "dividend"] },
  { symbol: "TXN", sector: "Technology", capTier: "large", style: ["value", "dividend"] },
  { symbol: "AMD", sector: "Technology", capTier: "large", style: ["growth"] },
  { symbol: "INTC", sector: "Technology", capTier: "large", style: ["value", "dividend"] },
  { symbol: "SNOW", sector: "Technology", capTier: "large", style: ["growth"] },
  { symbol: "PLTR", sector: "Technology", capTier: "large", style: ["growth"] },
  { symbol: "UBER", sector: "Technology", capTier: "large", style: ["growth"] },
  { symbol: "NET", sector: "Technology", capTier: "large", style: ["growth"] },
  { symbol: "DDOG", sector: "Technology", capTier: "large", style: ["growth"] },
  { symbol: "SQ", sector: "Technology", capTier: "mid", style: ["growth"] },
  { symbol: "PYPL", sector: "Technology", capTier: "large", style: ["value"] },
  { symbol: "CRWD", sector: "Technology", capTier: "large", style: ["growth"] },
  { symbol: "NOW", sector: "Technology", capTier: "large", style: ["growth"] },
  { symbol: "PANW", sector: "Technology", capTier: "large", style: ["growth"] },
  { symbol: "SHOP", sector: "Technology", capTier: "large", style: ["growth"] },
  { symbol: "MU", sector: "Technology", capTier: "large", style: ["blend"] },
  { symbol: "AMAT", sector: "Technology", capTier: "large", style: ["growth", "dividend"] },
  { symbol: "LRCX", sector: "Technology", capTier: "large", style: ["growth", "dividend"] },
  { symbol: "KLAC", sector: "Technology", capTier: "large", style: ["growth", "dividend"] },

  // Communication Services
  { symbol: "GOOGL", sector: "Communication Services", capTier: "mega", style: ["growth"] },
  { symbol: "META", sector: "Communication Services", capTier: "mega", style: ["growth"] },
  { symbol: "NFLX", sector: "Communication Services", capTier: "mega", style: ["growth"] },
  { symbol: "DIS", sector: "Communication Services", capTier: "large", style: ["blend"] },
  { symbol: "CMCSA", sector: "Communication Services", capTier: "large", style: ["value", "dividend"] },
  { symbol: "T", sector: "Communication Services", capTier: "large", style: ["value", "dividend"] },
  { symbol: "VZ", sector: "Communication Services", capTier: "large", style: ["value", "dividend"] },
  { symbol: "TMUS", sector: "Communication Services", capTier: "large", style: ["growth"] },
  { symbol: "SNAP", sector: "Communication Services", capTier: "mid", style: ["growth"] },
  { symbol: "PINS", sector: "Communication Services", capTier: "mid", style: ["growth"] },
  { symbol: "SPOT", sector: "Communication Services", capTier: "large", style: ["growth"] },

  // Consumer Discretionary
  { symbol: "AMZN", sector: "Consumer Discretionary", capTier: "mega", style: ["growth"] },
  { symbol: "TSLA", sector: "Consumer Discretionary", capTier: "mega", style: ["growth"] },
  { symbol: "HD", sector: "Consumer Discretionary", capTier: "mega", style: ["blend", "dividend"] },
  { symbol: "MCD", sector: "Consumer Discretionary", capTier: "mega", style: ["blend", "dividend"] },
  { symbol: "NKE", sector: "Consumer Discretionary", capTier: "large", style: ["blend", "dividend"] },
  { symbol: "SBUX", sector: "Consumer Discretionary", capTier: "large", style: ["blend", "dividend"] },
  { symbol: "LOW", sector: "Consumer Discretionary", capTier: "large", style: ["blend", "dividend"] },
  { symbol: "CMG", sector: "Consumer Discretionary", capTier: "large", style: ["growth"] },
  { symbol: "ABNB", sector: "Consumer Discretionary", capTier: "large", style: ["growth"] },
  { symbol: "BKNG", sector: "Consumer Discretionary", capTier: "large", style: ["growth"] },
  { symbol: "RCL", sector: "Consumer Discretionary", capTier: "large", style: ["growth"] },
  { symbol: "GM", sector: "Consumer Discretionary", capTier: "large", style: ["value", "dividend"] },
  { symbol: "F", sector: "Consumer Discretionary", capTier: "large", style: ["value", "dividend"] },
  { symbol: "RIVN", sector: "Consumer Discretionary", capTier: "mid", style: ["growth"] },
  { symbol: "LULU", sector: "Consumer Discretionary", capTier: "large", style: ["growth"] },
  { symbol: "TJX", sector: "Consumer Discretionary", capTier: "large", style: ["blend", "dividend"] },

  // Consumer Staples
  { symbol: "WMT", sector: "Consumer Staples", capTier: "mega", style: ["blend", "dividend"] },
  { symbol: "COST", sector: "Consumer Staples", capTier: "mega", style: ["growth"] },
  { symbol: "PG", sector: "Consumer Staples", capTier: "mega", style: ["value", "dividend"] },
  { symbol: "KO", sector: "Consumer Staples", capTier: "mega", style: ["value", "dividend"] },
  { symbol: "PEP", sector: "Consumer Staples", capTier: "mega", style: ["value", "dividend"] },
  { symbol: "PM", sector: "Consumer Staples", capTier: "large", style: ["value", "dividend"] },
  { symbol: "MO", sector: "Consumer Staples", capTier: "large", style: ["value", "dividend"] },
  { symbol: "MDLZ", sector: "Consumer Staples", capTier: "large", style: ["value", "dividend"] },
  { symbol: "CL", sector: "Consumer Staples", capTier: "large", style: ["value", "dividend"] },
  { symbol: "GIS", sector: "Consumer Staples", capTier: "large", style: ["value", "dividend"] },

  // Healthcare
  { symbol: "LLY", sector: "Healthcare", capTier: "mega", style: ["growth"] },
  { symbol: "UNH", sector: "Healthcare", capTier: "mega", style: ["growth", "dividend"] },
  { symbol: "JNJ", sector: "Healthcare", capTier: "mega", style: ["value", "dividend"] },
  { symbol: "ABBV", sector: "Healthcare", capTier: "mega", style: ["value", "dividend"] },
  { symbol: "MRK", sector: "Healthcare", capTier: "mega", style: ["value", "dividend"] },
  { symbol: "PFE", sector: "Healthcare", capTier: "mega", style: ["value", "dividend"] },
  { symbol: "AMGN", sector: "Healthcare", capTier: "large", style: ["blend", "dividend"] },
  { symbol: "GILD", sector: "Healthcare", capTier: "large", style: ["value", "dividend"] },
  { symbol: "VRTX", sector: "Healthcare", capTier: "large", style: ["growth"] },
  { symbol: "REGN", sector: "Healthcare", capTier: "large", style: ["growth"] },
  { symbol: "ISRG", sector: "Healthcare", capTier: "large", style: ["growth"] },
  { symbol: "BMY", sector: "Healthcare", capTier: "large", style: ["value", "dividend"] },
  { symbol: "ABT", sector: "Healthcare", capTier: "large", style: ["blend", "dividend"] },
  { symbol: "MDT", sector: "Healthcare", capTier: "large", style: ["value", "dividend"] },
  { symbol: "CVS", sector: "Healthcare", capTier: "large", style: ["value", "dividend"] },
  { symbol: "DXCM", sector: "Healthcare", capTier: "large", style: ["growth"] },
  { symbol: "ELV", sector: "Healthcare", capTier: "large", style: ["blend", "dividend"] },
  { symbol: "HUM", sector: "Healthcare", capTier: "large", style: ["blend"] },

  // Financial Services
  { symbol: "BRK-B", sector: "Financial Services", capTier: "mega", style: ["value"] },
  { symbol: "JPM", sector: "Financial Services", capTier: "mega", style: ["blend", "dividend"] },
  { symbol: "V", sector: "Financial Services", capTier: "mega", style: ["growth"] },
  { symbol: "MA", sector: "Financial Services", capTier: "mega", style: ["growth"] },
  { symbol: "BAC", sector: "Financial Services", capTier: "mega", style: ["value", "dividend"] },
  { symbol: "GS", sector: "Financial Services", capTier: "large", style: ["blend", "dividend"] },
  { symbol: "MS", sector: "Financial Services", capTier: "large", style: ["blend", "dividend"] },
  { symbol: "BLK", sector: "Financial Services", capTier: "large", style: ["blend", "dividend"] },
  { symbol: "AXP", sector: "Financial Services", capTier: "large", style: ["blend", "dividend"] },
  { symbol: "SCHW", sector: "Financial Services", capTier: "large", style: ["blend"] },
  { symbol: "WFC", sector: "Financial Services", capTier: "large", style: ["value", "dividend"] },
  { symbol: "BX", sector: "Financial Services", capTier: "large", style: ["growth", "dividend"] },
  { symbol: "KKR", sector: "Financial Services", capTier: "large", style: ["growth"] },
  { symbol: "COF", sector: "Financial Services", capTier: "large", style: ["value", "dividend"] },
  { symbol: "C", sector: "Financial Services", capTier: "large", style: ["value", "dividend"] },
  { symbol: "USB", sector: "Financial Services", capTier: "large", style: ["value", "dividend"] },
  { symbol: "PNC", sector: "Financial Services", capTier: "large", style: ["value", "dividend"] },
  { symbol: "APO", sector: "Financial Services", capTier: "large", style: ["growth", "dividend"] },

  // Energy
  { symbol: "XOM", sector: "Energy", capTier: "mega", style: ["value", "dividend"] },
  { symbol: "CVX", sector: "Energy", capTier: "mega", style: ["value", "dividend"] },
  { symbol: "COP", sector: "Energy", capTier: "large", style: ["value", "dividend"] },
  { symbol: "EOG", sector: "Energy", capTier: "large", style: ["value", "dividend"] },
  { symbol: "SLB", sector: "Energy", capTier: "large", style: ["blend"] },
  { symbol: "MPC", sector: "Energy", capTier: "large", style: ["value", "dividend"] },
  { symbol: "VLO", sector: "Energy", capTier: "large", style: ["value", "dividend"] },
  { symbol: "OXY", sector: "Energy", capTier: "large", style: ["value", "dividend"] },
  { symbol: "HAL", sector: "Energy", capTier: "large", style: ["blend"] },
  { symbol: "PSX", sector: "Energy", capTier: "large", style: ["value", "dividend"] },

  // Industrials
  { symbol: "CAT", sector: "Industrials", capTier: "mega", style: ["blend", "dividend"] },
  { symbol: "HON", sector: "Industrials", capTier: "large", style: ["blend", "dividend"] },
  { symbol: "UPS", sector: "Industrials", capTier: "large", style: ["value", "dividend"] },
  { symbol: "BA", sector: "Industrials", capTier: "large", style: ["blend"] },
  { symbol: "RTX", sector: "Industrials", capTier: "large", style: ["blend", "dividend"] },
  { symbol: "DE", sector: "Industrials", capTier: "large", style: ["blend", "dividend"] },
  { symbol: "GE", sector: "Industrials", capTier: "large", style: ["growth"] },
  { symbol: "LMT", sector: "Industrials", capTier: "large", style: ["value", "dividend"] },
  { symbol: "NOC", sector: "Industrials", capTier: "large", style: ["value", "dividend"] },
  { symbol: "FDX", sector: "Industrials", capTier: "large", style: ["blend"] },
  { symbol: "UNP", sector: "Industrials", capTier: "large", style: ["blend", "dividend"] },
  { symbol: "ETN", sector: "Industrials", capTier: "large", style: ["growth", "dividend"] },
  { symbol: "MMM", sector: "Industrials", capTier: "large", style: ["value", "dividend"] },
  { symbol: "GEV", sector: "Industrials", capTier: "large", style: ["growth"] },
  { symbol: "AXON", sector: "Industrials", capTier: "large", style: ["growth"] },

  // Materials
  { symbol: "LIN", sector: "Materials", capTier: "mega", style: ["blend", "dividend"] },
  { symbol: "APD", sector: "Materials", capTier: "large", style: ["blend", "dividend"] },
  { symbol: "SHW", sector: "Materials", capTier: "large", style: ["blend", "dividend"] },
  { symbol: "ECL", sector: "Materials", capTier: "large", style: ["blend", "dividend"] },
  { symbol: "NEM", sector: "Materials", capTier: "large", style: ["value", "dividend"] },
  { symbol: "FCX", sector: "Materials", capTier: "large", style: ["blend"] },
  { symbol: "NUE", sector: "Materials", capTier: "large", style: ["value", "dividend"] },
  { symbol: "ALB", sector: "Materials", capTier: "mid", style: ["growth"] },

  // Real Estate
  { symbol: "PLD", sector: "Real Estate", capTier: "large", style: ["blend", "dividend"] },
  { symbol: "AMT", sector: "Real Estate", capTier: "large", style: ["growth", "dividend"] },
  { symbol: "EQIX", sector: "Real Estate", capTier: "large", style: ["growth", "dividend"] },
  { symbol: "WELL", sector: "Real Estate", capTier: "large", style: ["blend", "dividend"] },
  { symbol: "SPG", sector: "Real Estate", capTier: "large", style: ["value", "dividend"] },
  { symbol: "PSA", sector: "Real Estate", capTier: "large", style: ["value", "dividend"] },
  { symbol: "DLR", sector: "Real Estate", capTier: "large", style: ["growth", "dividend"] },
  { symbol: "O", sector: "Real Estate", capTier: "large", style: ["value", "dividend"] },
  { symbol: "CCI", sector: "Real Estate", capTier: "large", style: ["value", "dividend"] },

  // Utilities
  { symbol: "NEE", sector: "Utilities", capTier: "large", style: ["growth", "dividend"] },
  { symbol: "SO", sector: "Utilities", capTier: "large", style: ["value", "dividend"] },
  { symbol: "DUK", sector: "Utilities", capTier: "large", style: ["value", "dividend"] },
  { symbol: "AEP", sector: "Utilities", capTier: "large", style: ["value", "dividend"] },
  { symbol: "XEL", sector: "Utilities", capTier: "mid", style: ["value", "dividend"] },
  { symbol: "ETR", sector: "Utilities", capTier: "mid", style: ["value", "dividend"] },
  { symbol: "D", sector: "Utilities", capTier: "large", style: ["value", "dividend"] },
  { symbol: "EXC", sector: "Utilities", capTier: "large", style: ["value", "dividend"] },
];

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const sectorsRaw = u.searchParams.get("sectors") ?? "";
  const stylesRaw = u.searchParams.get("styles") ?? "";
  const capTierRaw = (u.searchParams.get("capTier") ?? "any").toLowerCase();
  const excludeRaw = u.searchParams.get("exclude") ?? "";

  const wantedSectors = sectorsRaw
    ? sectorsRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const wantedStyles = stylesRaw
    ? (stylesRaw.split(",").map((s) => s.trim().toLowerCase()) as StyleTag[]).filter(Boolean)
    : [];
  const excludeSet = new Set(
    excludeRaw ? excludeRaw.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean) : []
  );

  let filtered = UNIVERSE.filter((entry) => {
    if (excludeSet.has(entry.symbol)) return false;
    if (wantedSectors.length > 0 && !wantedSectors.includes(entry.sector)) return false;
    // Style filtering is handled client-side via dynamic Yahoo Finance data classification
    if (capTierRaw !== "any" && entry.capTier !== capTierRaw) return false;
    return true;
  });

  filtered = shuffle(filtered);

  return NextResponse.json({
    symbols: filtered.map((e) => e.symbol),
    total: filtered.length,
  });
}
