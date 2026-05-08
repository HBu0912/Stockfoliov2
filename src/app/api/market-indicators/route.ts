import { NextResponse } from "next/server";

type IndicatorsPayload = {
  fearGreed: number | null;
  fearGreedLabel: string | null;
  putCall: number | null;
  aaiiBullish: number | null;
  aaiiBearish: number | null;
  aaiiSpread: number | null;
};

async function fetchFearGreed(): Promise<{ value: number | null; label: string | null }> {
  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=1&format=json", { cache: "no-store" });
    if (!res.ok) return { value: null, label: null };
    const json = (await res.json()) as { data?: Array<{ value?: string; value_classification?: string }> };
    const row = json.data?.[0];
    return { value: row?.value ? Number(row.value) : null, label: row?.value_classification ?? null };
  } catch {
    return { value: null, label: null };
  }
}

async function fetchAaii(): Promise<{ bullish: number | null; bearish: number | null; spread: number | null }> {
  try {
    const res = await fetch("https://www.aaii.com/sentimentsurvey/sent_results", { cache: "no-store" });
    if (!res.ok) return { bullish: null, bearish: null, spread: null };
    const html = await res.text();
    const pick = (label: "Bullish" | "Bearish") => {
      const re = new RegExp(`${label}[\\s\\S]{0,200}?([0-9]+\\.[0-9]+)%`, "i");
      const m = html.match(re);
      return m?.[1] ? Number(m[1]) : null;
    };
    const bullish = pick("Bullish");
    const bearish = pick("Bearish");
    const spread = bullish != null && bearish != null ? bullish - bearish : null;
    return { bullish, bearish, spread };
  } catch {
    return { bullish: null, bearish: null, spread: null };
  }
}

export async function GET() {
  const [fear, aaii] = await Promise.all([fetchFearGreed(), fetchAaii()]);
  const out: IndicatorsPayload = {
    fearGreed: fear.value,
    fearGreedLabel: fear.label,
    putCall: null,
    aaiiBullish: aaii.bullish,
    aaiiBearish: aaii.bearish,
    aaiiSpread: aaii.spread,
  };
  return NextResponse.json(out);
}

