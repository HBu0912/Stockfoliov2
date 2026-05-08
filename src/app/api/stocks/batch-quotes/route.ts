import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yahoo = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get("symbols") ?? "";
  const symbols = symbolsParam
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 50);

  if (!symbols.length) return NextResponse.json({ quotes: [] });

  try {
    // yahoo-finance2 accepts an array of symbols for batch quoting
    const results = await Promise.all(
      symbols.map(async (sym) => {
        try {
          const q = await yahoo.quote(sym, { fields: ["regularMarketPrice", "regularMarketChangePercent", "shortName", "longName"] });
          return {
            symbol: sym,
            price: q.regularMarketPrice ?? null,
            changePct: typeof q.regularMarketChangePercent === "number" ? q.regularMarketChangePercent : null,
            name: q.shortName ?? q.longName ?? null,
          };
        } catch {
          return { symbol: sym, price: null, changePct: null, name: null };
        }
      })
    );
    return NextResponse.json({ quotes: results });
  } catch {
    return NextResponse.json({ quotes: [] }, { status: 500 });
  }
}
