/** Aggregated from top-weighted holdings + quote metrics (same scale as /api/stocks metrics). */

export type PersonaSlice = {
  pct: number;
  beta: number | null;
  dividendYield: number | null;
  forwardPE: number | null;
  roe: number | null;
  sector: string | null;
  marketCap: number | null;
  symbol: string;
  name: string;
};

function isCoreIndexEtf(row: { symbol: string; name: string }) {
  return /SPY|IVV|VOO|QQQ|DIA|VTI|SCHB|ITOT|^ONEQ$|NASDAQ-?100|S&P ?500|DOW/i.test(`${row.symbol} ${row.name}`);
}

function isAnyEtf(row: { symbol: string; name: string }) {
  return /\bETF\b|FUND|SPY|IVV|VOO|QQQ|DIA|VTI|IWM|XLF|XLE|XLK|XLV|XLY|XLP|IBIT|FBTC|BITB/i.test(`${row.symbol} ${row.name}`);
}

function isTechHeavy(row: { symbol: string; name: string }) {
  return /QQQ|ONEQ|XLK|VGT|SMH|SOXX|IGV|Technology|Software|Semiconductor/i.test(`${row.symbol} ${row.name}`);
}

function isFinancials(row: { symbol: string; name: string; sector: string | null }) {
  const s = `${row.sector ?? ""} ${row.name}`.toLowerCase();
  return /financial|bank|insurance|reit/i.test(s);
}

function isEnergy(row: { symbol: string; name: string; sector: string | null }) {
  const s = `${row.sector ?? ""} ${row.name}`.toLowerCase();
  return /energy|oil|gas|petroleum/i.test(s);
}

/** Build persona inputs from weighted slices (e.g. top holdings with quote metrics). */
export function aggregatePersonaInputs(parts: PersonaSlice[]): PersonaInputs {
  const total = Math.max(1e-6, parts.reduce((s, p) => s + p.pct, 0));
  let etfPct = 0;
  let coreIndexPct = 0;
  let techSectorPct = 0;
  let financialsPct = 0;
  let energyPct = 0;
  let largeCapPct = 0;
  let smallCapPct = 0;
  let betaNum = 0;
  let divNum = 0;
  let fpeNum = 0;
  let roeNum = 0;

  for (const p of parts) {
    const row = { symbol: p.symbol, name: p.name };
    if (isAnyEtf(row)) etfPct += p.pct;
    if (isCoreIndexEtf(row)) coreIndexPct += p.pct;
    if (isTechHeavy(row) || /technology|software|semiconductor/i.test((p.sector ?? "").toLowerCase())) techSectorPct += p.pct;
    if (isFinancials({ ...row, sector: p.sector })) financialsPct += p.pct;
    if (isEnergy({ ...row, sector: p.sector })) energyPct += p.pct;
    const mc = p.marketCap ?? 0;
    if (mc >= 10e9) largeCapPct += p.pct;
    if (mc > 0 && mc < 2e9) smallCapPct += p.pct;
    betaNum += (p.beta ?? 1) * p.pct;
    divNum += (p.dividendYield ?? 0) * p.pct;
    fpeNum += (p.forwardPE ?? 0) * p.pct;
    roeNum += (p.roe ?? 0) * p.pct;
  }

  const top3Pct = parts
    .slice()
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 3)
    .reduce((s, p) => s + p.pct, 0);

  return {
    positionCount: parts.length,
    top3Pct,
    etfPct,
    coreIndexPct,
    techSectorPct,
    financialsPct,
    energyPct,
    largeCapPct,
    smallCapPct,
    weightedBeta: Number.isFinite(betaNum / total) ? betaNum / total : null,
    weightedDividendYield: Number.isFinite(divNum / total) ? divNum / total : null,
    weightedForwardPe: fpeNum > 0 && Number.isFinite(fpeNum / total) ? fpeNum / total : null,
    weightedRoe: roeNum > 0 && Number.isFinite(roeNum / total) ? roeNum / total : null,
  };
}

export type PersonaInputs = {
  positionCount: number;
  top3Pct: number;
  etfPct: number;
  coreIndexPct: number;
  techSectorPct: number;
  financialsPct: number;
  energyPct: number;
  largeCapPct: number;
  smallCapPct: number;
  weightedBeta: number | null;
  weightedDividendYield: number | null; // 0.02 = 2%
  weightedForwardPe: number | null;
  weightedRoe: number | null;
};

export type InvestorPersona = { title: string; subtitle: string };

export function deriveInvestorPersona(m: PersonaInputs): InvestorPersona {
  const div = m.weightedDividendYield ?? 0;
  const beta = m.weightedBeta ?? 1;
  const fpe = m.weightedForwardPe ?? 0;
  const roe = m.weightedRoe ?? 0;

  const income = div >= 0.028;
  const defensive = beta < 0.95 && m.largeCapPct > 50;
  const growthy = fpe > 0 && fpe < 40 && (m.techSectorPct > 28 || beta > 1.12);
  const dividendDef = income && m.top3Pct < 55;
  const techBull = m.techSectorPct > 35 && beta > 1.05;
  const concentrated = m.top3Pct > 62;
  const diversified = m.positionCount >= 14 && m.top3Pct < 42;
  const valueTilt = fpe > 0 && fpe < 16 && div > 0.015;
  const quality = roe > 0.16;

  let title = "Balanced allocator";
  if (dividendDef && defensive) title = "Dividend defensive";
  else if (techBull && growthy) title = "Growth-focused tech bull";
  else if (techBull) title = "Tech-heavy optimist";
  else if (income && !techBull) title = "Income-first investor";
  else if (valueTilt && quality) title = "Quality value hunter";
  else if (concentrated && growthy) title = "High-conviction growth";
  else if (diversified) title = "Diversified core builder";
  else if (m.energyPct > 18) title = "Cyclicals & energy tilt";
  else if (m.financialsPct > 22) title = "Financials-heavy allocator";

  const parts: string[] = [];
  if (diversified) parts.push("broad sleeve of names");
  else if (concentrated) parts.push("concentrated in a few convictions");
  else parts.push("a moderate number of positions");
  if (m.coreIndexPct > 40) parts.push("heavy core index ETF usage");
  if (techBull) parts.push("meaningful technology exposure");
  if (income) parts.push(`income tilt (~${(div * 100).toFixed(1)}% blended yield)`);
  if (beta > 1.2) parts.push("above-market beta");
  else if (beta < 0.9) parts.push("lower volatility bias");
  const subtitle = parts.slice(0, 3).join(", ") + ".";

  return { title, subtitle: subtitle.charAt(0).toUpperCase() + subtitle.slice(1) };
}
