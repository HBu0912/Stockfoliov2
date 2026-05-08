"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArenaConvictionPanel } from "@/components/ArenaConvictionPanel";
import { HoldingPie } from "@/components/HoldingPie";
import { TickerSymbol } from "@/components/TickerSymbol";
import type { Holding } from "@prisma/client";
import { formatPctChangeLine } from "@/lib/feed-copy";

type Row = { label: string; name: string; value: number; pct: number };
type Member = { user: { id: string; name: string | null; email: string }; rows: Row[] };
type Feed = {
  id: string;
  userId: string;
  symbol: string;
  title: string;
  kind: string;
  pct: number;
  oldShares: number;
  newShares: number;
  accountName: string | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string };
};
type D = {
  arena: {
    id: string;
    name: string;
    joinCode: string;
    createdById: string;
    meId: string;
    isCreator: boolean;
  };
  portfolios: Member[];
  feeds: Feed[];
};
type ArenaChatMessage = {
  id: string;
  body: string;
  shareUrl: string | null;
  createdAt: string;
  sender: { id: string; name: string | null; email: string };
};
type PortfolioInsight = {
  title: string;
  riskTolerance: string;
  concentration: string;
  capTilt: string;
  etfConcentration: string;
  indexConcentration: string;
  mainIndustries: string[];
  riskScore: number;
  weightedBeta: number | null;
  avgPe: number | null;
  avgForwardPe: number | null;
  weightedPeg: number | null;
  weightedProfitMargin: number | null;
  weightedRoe: number | null;
  weightedDividendYield: number | null;
  weightedPriceToBook: number | null;
  weightedEvToRevenue: number | null;
  weightedEvToEbitda: number | null;
  weightedGrossMargin: number | null;
  weightedOperatingMargin: number | null;
  topHoldings: Array<{ symbol: string; pct: number }>;
};
type ArenaBadge = { key: string; emoji: string; title: string; winner: string; detail: string };

type ArenaOverview = { badges: ArenaBadge[] };
const ANALYZE_INTERVALS = ["1D", "1W", "1M", "3M", "YTD", "1Y", "5Y", "ALL"] as const;
type AnalyzeInterval = (typeof ANALYZE_INTERVALS)[number];

function MiniInfo({ text }: { text: string }) {
  return (
    <span className="group relative ml-1 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-(--card-border) text-[10px] text-(--muted)">
      i
      <span className="pointer-events-none absolute left-1/2 top-5 z-20 hidden w-60 -translate-x-1/2 rounded-md border border-(--card-border) bg-(--background) p-2 text-xs text-(--muted) shadow-lg group-hover:block">
        {text}
      </span>
    </span>
  );
}

function toPieHoldings(rows: Row[]) {
  return rows.map((r) => ({
    id: r.label,
    symbol: r.label,
    name: r.name,
    shares: r.value,
    lastPrice: 1,
  })) as unknown as Pick<Holding, "id" | "symbol" | "name" | "shares" | "lastPrice">[];
}

export default function ArenaDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [data, setData] = useState<D | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [rename, setRename] = useState("");
  const [memberSort, setMemberSort] = useState<"name" | "topPct">("name");
  const [memberSortDir, setMemberSortDir] = useState<"asc" | "desc">("asc");
  const [otherSortDir, setOtherSortDir] = useState<"asc" | "desc">("desc");
  const [chat, setChat] = useState<ArenaChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [analyzingUserId, setAnalyzingUserId] = useState<string | null>(null);
  const [insightOpen, setInsightOpen] = useState(false);
  const [insight, setInsight] = useState<PortfolioInsight | null>(null);
  const [analyzeInterval, setAnalyzeInterval] = useState<AnalyzeInterval>("1M");
  const [analyzedSymbols, setAnalyzedSymbols] = useState<string[]>([]);
  const [moversLoading, setMoversLoading] = useState(false);
  const [movers, setMovers] = useState<Array<{ symbol: string; changePct: number }>>([]);
  const [arenaOverview, setArenaOverview] = useState<ArenaOverview | null>(null);
  const [voteJumpSymbol, setVoteJumpSymbol] = useState<string | null>(null);
  const [rightColumnTab, setRightColumnTab] = useState<"feed" | "votes">("feed");
  const [arenaPieHeight, setArenaPieHeight] = useState(260);

  useEffect(() => {
    function pickArenaPieHeight() {
      const w = typeof window !== "undefined" ? window.innerWidth : 1024;
      if (w < 480) setArenaPieHeight(220);
      else if (w < 1024) setArenaPieHeight(300);
      else setArenaPieHeight(430);
    }
    pickArenaPieHeight();
    window.addEventListener("resize", pickArenaPieHeight);
    return () => window.removeEventListener("resize", pickArenaPieHeight);
  }, []);

  const load = useCallback(async () => {
    setErr(null);
    const r = await fetch(`/api/arenas/${id}`);
    if (!r.ok) return void setErr("Could not open arena (members only)");
    const d = (await r.json()) as D;
    setData(d);
    setRename(d.arena.name);
    setSelectedUserId((cur) => cur || d.portfolios.find((p) => p.user.id !== d.arena.meId)?.user.id || d.arena.meId);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadChat = useCallback(async () => {
    const r = await fetch(`/api/arenas/${id}/chat`);
    if (!r.ok) return;
    const d = (await r.json()) as { messages: ArenaChatMessage[] };
    setChat(d.messages ?? []);
  }, [id]);

  useEffect(() => {
    void loadChat();
  }, [loadChat]);

  const me = useMemo(() => data?.portfolios.find((p) => p.user.id === data.arena.meId) ?? null, [data]);
  const selected = useMemo(() => data?.portfolios.find((p) => p.user.id === selectedUserId) ?? null, [data, selectedUserId]);
  const selectedFeed = useMemo(() => (selected ? data?.feeds.filter((f) => f.userId === selected.user.id).slice(0, 25) ?? [] : []), [data, selected]);
  const sharedWithPct = useMemo(() => {
    if (!me || !selected) return [] as Array<{ ticker: string; mePct: number; otherPct: number }>;
    const mine = new Map(me.rows.map((r) => [r.label, r.pct]));
    return selected.rows
      .filter((r) => mine.has(r.label))
      .map((r) => ({ ticker: r.label, mePct: mine.get(r.label) ?? 0, otherPct: r.pct }))
      .slice(0, 20);
  }, [me, selected]);
  const sortedMembers = useMemo(() => {
    const list = [...(data?.portfolios ?? [])];
    list.sort((a, b) => {
      if (memberSort === "name") {
        const an = (a.user.name || a.user.email).toLowerCase();
        const bn = (b.user.name || b.user.email).toLowerCase();
        return memberSortDir === "asc" ? an.localeCompare(bn) : bn.localeCompare(an);
      }
      const ap = a.rows[0]?.pct ?? 0;
      const bp = b.rows[0]?.pct ?? 0;
      return memberSortDir === "asc" ? ap - bp : bp - ap;
    });
    return list;
  }, [data?.portfolios, memberSort, memberSortDir]);
  const otherHoldings = useMemo(() => {
    if (!selected) return [] as Row[];
    return [...selected.rows].sort((a, b) =>
      otherSortDir === "asc" ? a.label.localeCompare(b.label) : b.pct - a.pct
    );
  }, [selected, otherSortDir]);

  const arenaTickerUniverse = useMemo(() => {
    const u = new Set<string>();
    for (const p of data?.portfolios ?? []) {
      for (const r of p.rows) u.add(r.label.trim().toUpperCase());
    }
    return [...u].sort((a, b) => a.localeCompare(b));
  }, [data?.portfolios]);

  useEffect(() => {
    let cancelled = false;
    async function buildArenaOverview() {
      if (!data?.portfolios?.length) return;
      const isIndexTrackedEtf = (row: Row) =>
        /\bETF\b|FUND|SPY|IVV|VOO|QQQ|DIA|VTI|SCHB|ITOT|IWM|RSP|VUG|VTV|ONEQ|S&P|NASDAQ|DOW/i.test(
          `${row.label} ${row.name}`
        );
      const singleStockBets = data.portfolios.flatMap((p) =>
        p.rows
          .filter((r) => !isIndexTrackedEtf(r))
          .map((r) => ({ user: p.user.name || p.user.email.split("@")[0], ticker: r.label, pct: r.pct }))
      );
      const biggestSingleStockBet = singleStockBets.sort((a, b) => b.pct - a.pct)[0] ?? null;
      const byPositions = data.portfolios
        .map((p) => ({ user: p.user.name || p.user.email.split("@")[0], count: p.rows.length }))
        .sort((a, b) => b.count - a.count);
      const mostPositions = byPositions[0] ?? null;
      const leastPositions = byPositions[byPositions.length - 1] ?? null;
      const concentration = data.portfolios
        .map((p) => ({
          user: p.user.name || p.user.email.split("@")[0],
          top3Pct: p.rows.slice(0, 3).reduce((s, r) => s + r.pct, 0),
        }))
        .sort((a, b) => b.top3Pct - a.top3Pct);
      const mostConcentrated = concentration[0] ?? null;

      const fetchTargets = data.portfolios.flatMap((p) => p.rows.slice(0, 8).map((r) => ({ userId: p.user.id, row: r })));
      const details = await Promise.all(
        fetchTargets.map(async (item) => {
          try {
            const res = await fetch(`/api/stocks/${encodeURIComponent(item.row.label)}?interval=1M&newsLimit=1&newsOffset=0`);
            if (!res.ok) return null;
            const d = (await res.json()) as {
              industry?: string | null;
              sector?: string | null;
              metrics?: {
                dividendYield?: number | null;
                beta?: number | null;
                forwardPE?: number | null;
                returnOnEquity?: number | null;
              };
            };
            return {
              userId: item.userId,
              pct: item.row.pct,
              industry: (d.industry ?? d.sector ?? "").trim(),
              sector: (d.sector ?? "").trim(),
              dividend: d.metrics?.dividendYield ?? null,
              beta: d.metrics?.beta ?? null,
              forwardPE: d.metrics?.forwardPE ?? null,
              roe: d.metrics?.returnOnEquity ?? null,
              label: item.row.label,
              name: item.row.name,
            };
          } catch {
            return null;
          }
        })
      );
      if (cancelled) return;
      const valid = details.filter(Boolean) as Array<{
        userId: string;
        pct: number;
        industry: string;
        sector: string;
        dividend: number | null;
        beta: number | null;
        forwardPE: number | null;
        roe: number | null;
        label: string;
        name: string;
      }>;
      const industryWeights = new Map<string, number>();
      const userIndustries = new Map<string, Set<string>>();
      for (const d of valid) {
        if (!d.industry || /^unknown$/i.test(d.industry)) continue;
        industryWeights.set(d.industry, (industryWeights.get(d.industry) ?? 0) + d.pct);
        const set = userIndustries.get(d.userId) ?? new Set<string>();
        set.add(d.industry);
        userIndustries.set(d.userId, set);
      }
      const topIndustryRow = [...industryWeights.entries()].sort((a, b) => b[1] - a[1])[0];
      const topIndustry = topIndustryRow?.[0] ?? null;
      const topIndustryPct = topIndustryRow?.[1] ?? 0;
      const diversifiedUsers = data.portfolios
        .map((p) => ({
          user: p.user.name || p.user.email.split("@")[0],
          count: userIndustries.get(p.user.id)?.size ?? 0,
        }))
        .sort((a, b) => b.count - a.count);
      const mostIndustryDiversified = diversifiedUsers[0] ?? null;

      type UserAgg = {
        label: string;
        divNum: number;
        divDen: number;
        betaNum: number;
        betaDen: number;
        fpeNum: number;
        fpeDen: number;
        roeNum: number;
        roeDen: number;
        techPct: number;
        etfPct: number;
        finPct: number;
        enPct: number;
      };
      const userIdToName = new Map(data.portfolios.map((p) => [p.user.id, p.user.name || p.user.email.split("@")[0]] as const));
      const agg = new Map<string, UserAgg>();
      const isEtfRow = (row: { label: string; name: string }) =>
        /\bETF\b|FUND|SPY|IVV|VOO|QQQ|DIA|VTI|IWM|XLF|XLE|XLK|XLV|XLY|XLP|IBIT|FBTC|BITB/i.test(`${row.label} ${row.name}`);
      for (const row of valid) {
        const uid = row.userId;
        const cur = agg.get(uid) ?? {
          label: userIdToName.get(uid) ?? "Member",
          divNum: 0,
          divDen: 0,
          betaNum: 0,
          betaDen: 0,
          fpeNum: 0,
          fpeDen: 0,
          roeNum: 0,
          roeDen: 0,
          techPct: 0,
          etfPct: 0,
          finPct: 0,
          enPct: 0,
        };
        if (row.dividend != null && Number.isFinite(row.dividend)) {
          cur.divNum += row.dividend * row.pct;
          cur.divDen += row.pct;
        }
        if (row.beta != null && Number.isFinite(row.beta)) {
          cur.betaNum += row.beta * row.pct;
          cur.betaDen += row.pct;
        }
        if (row.forwardPE != null && Number.isFinite(row.forwardPE) && row.forwardPE > 0) {
          cur.fpeNum += row.forwardPE * row.pct;
          cur.fpeDen += row.pct;
        }
        if (row.roe != null && Number.isFinite(row.roe) && row.roe > 0) {
          cur.roeNum += row.roe * row.pct;
          cur.roeDen += row.pct;
        }
        const sec = `${row.sector} ${row.name}`.toLowerCase();
        if (/technology|software|semiconductor|internet/i.test(sec)) cur.techPct += row.pct;
        if (/financial|bank|insurance|reit/i.test(sec)) cur.finPct += row.pct;
        if (/energy|oil|gas|petroleum/i.test(sec)) cur.enPct += row.pct;
        if (isEtfRow(row)) cur.etfPct += row.pct;
        agg.set(uid, cur);
      }
      const aggRows = [...agg.entries()].map(([, v]) => ({
        label: v.label,
        div: v.divDen > 0 ? v.divNum / v.divDen : 0,
        beta: v.betaDen > 0 ? v.betaNum / v.betaDen : 0,
        fpe: v.fpeDen > 0 ? v.fpeNum / v.fpeDen : 0,
        roe: v.roeDen > 0 ? v.roeNum / v.roeDen : 0,
        tech: v.techPct,
        etf: v.etfPct,
        fin: v.finPct,
        en: v.enPct,
      }));
      const byMax = (key: "div" | "beta" | "tech" | "etf" | "fin" | "en" | "fpe" | "roe") => {
        const sorted = [...aggRows].filter((x) => x[key] > 0).sort((a, b) => b[key] - a[key]);
        return sorted[0] ?? null;
      };
      const byMinBeta = () => {
        const sorted = [...aggRows].filter((x) => x.beta > 0).sort((a, b) => a.beta - b.beta);
        return sorted[0] ?? null;
      };
      const badges: ArenaBadge[] = [];
      if (mostIndustryDiversified && mostIndustryDiversified.count >= 2) {
        badges.push({
          key: "diverse",
          emoji: "🌐",
          title: "Most diversified",
          winner: mostIndustryDiversified.user,
          detail: `${mostIndustryDiversified.count} industries in sampled holdings`,
        });
      }
      if (biggestSingleStockBet && biggestSingleStockBet.pct >= 12) {
        badges.push({
          key: "whale",
          emoji: "🐋",
          title: "Largest single-stock bet",
          winner: biggestSingleStockBet.user,
          detail: `${biggestSingleStockBet.ticker} · ${biggestSingleStockBet.pct.toFixed(1)}%`,
        });
      }
      if (mostPositions && leastPositions && mostPositions.count !== leastPositions.count) {
        badges.push({
          key: "wide",
          emoji: "📚",
          title: "Most positions",
          winner: mostPositions.user,
          detail: `${mostPositions.count} names vs arena low of ${leastPositions.count}`,
        });
        badges.push({
          key: "tight",
          emoji: "🎯",
          title: "Most focused book",
          winner: leastPositions.user,
          detail: `${leastPositions.count} positions`,
        });
      }
      if (mostConcentrated && mostConcentrated.top3Pct >= 52) {
        badges.push({
          key: "top3",
          emoji: "⚓",
          title: "Top-3 heavyweight",
          winner: mostConcentrated.user,
          detail: `Top 3 = ${mostConcentrated.top3Pct.toFixed(1)}% of book`,
        });
      }
      if (topIndustry) {
        badges.push({
          key: "spine",
          emoji: "🧭",
          title: "Group industry spine",
          winner: topIndustry,
          detail: `${topIndustryPct.toFixed(1)}% blended across sampled names`,
        });
      }
      const topDiv = byMax("div");
      if (topDiv && topDiv.div >= 0.012) {
        badges.push({
          key: "div",
          emoji: "💰",
          title: "Highest dividend tilt",
          winner: topDiv.label,
          detail: `~${(topDiv.div * 100).toFixed(2)}% blended on sample`,
        });
      }
      const topTech = byMax("tech");
      if (topTech && topTech.tech >= 18) {
        badges.push({
          key: "tech",
          emoji: "🚀",
          title: "Tech-heavy",
          winner: topTech.label,
          detail: `${topTech.tech.toFixed(1)}% in tech-like sleeves (sample)`,
        });
      }
      const topEtf = byMax("etf");
      if (topEtf && topEtf.etf >= 25) {
        badges.push({
          key: "etf",
          emoji: "📊",
          title: "ETF allocator",
          winner: topEtf.label,
          detail: `${topEtf.etf.toFixed(1)}% ETF/Fund exposure (sample)`,
        });
      }
      const topBeta = byMax("beta");
      if (topBeta && topBeta.beta >= 1.18) {
        badges.push({
          key: "beta",
          emoji: "⚡",
          title: "Highest beta",
          winner: topBeta.label,
          detail: `~${topBeta.beta.toFixed(2)} weighted beta (sample)`,
        });
      }
      const lowBeta = byMinBeta();
      if (lowBeta && lowBeta.beta > 0 && lowBeta.beta <= 0.92) {
        badges.push({
          key: "lowbeta",
          emoji: "🛡️",
          title: "Lowest beta",
          winner: lowBeta.label,
          detail: `~${lowBeta.beta.toFixed(2)} weighted beta (sample)`,
        });
      }
      const topFpe = byMax("fpe");
      if (topFpe && topFpe.fpe >= 28) {
        badges.push({
          key: "growth",
          emoji: "📈",
          title: "Growth multiple tilt",
          winner: topFpe.label,
          detail: `~${topFpe.fpe.toFixed(1)}x blended forward P/E (sample)`,
        });
      }
      const topRoe = byMax("roe");
      if (topRoe && topRoe.roe >= 0.18) {
        badges.push({
          key: "quality",
          emoji: "✨",
          title: "Quality / ROE tilt",
          winner: topRoe.label,
          detail: `~${(topRoe.roe * 100).toFixed(1)}% blended ROE (sample)`,
        });
      }
      const topFin = byMax("fin");
      if (topFin && topFin.fin >= 20) {
        badges.push({
          key: "fin",
          emoji: "🏛️",
          title: "Financials tilt",
          winner: topFin.label,
          detail: `${topFin.fin.toFixed(1)}% financials-like (sample)`,
        });
      }
      const topEn = byMax("en");
      if (topEn && topEn.en >= 18) {
        badges.push({
          key: "en",
          emoji: "🛢️",
          title: "Energy tilt",
          winner: topEn.label,
          detail: `${topEn.en.toFixed(1)}% energy-like (sample)`,
        });
      }

      setArenaOverview({ badges });
    }
    void buildArenaOverview();
    return () => {
      cancelled = true;
    };
  }, [data]);

  async function renameArena(e: React.FormEvent) {
    e.preventDefault();
    if (!rename.trim()) return;
    const r = await fetch(`/api/arenas/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: rename.trim() }) });
    if (!r.ok) return void setErr("Could not rename arena");
    await load();
  }

  async function deleteArena() {
    if (!confirm("Are you sure you want to delete this arena for all members?")) return;
    const r = await fetch(`/api/arenas/${id}`, { method: "DELETE" });
    if (!r.ok) return void setErr("Could not delete arena");
    router.push("/arena");
  }

  async function removeMember(userId: string) {
    if (!confirm("Are you sure you want to remove this user from the arena?")) return;
    const r = await fetch(`/api/arenas/${id}/members/${userId}`, { method: "DELETE" });
    if (!r.ok) return void setErr("Could not remove user");
    await load();
  }

  async function sendArenaChat(e: React.FormEvent) {
    e.preventDefault();
    const text = chatDraft.trim();
    if (!text) return;
    const r = await fetch(`/api/arenas/${id}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text }),
    });
    if (!r.ok) return;
    setChatDraft("");
    await loadChat();
  }

  async function analyzePortfolio(member: Member) {
    setAnalyzingUserId(member.user.id);
    setInsightOpen(true);
    setInsight(null);
    setAnalyzedSymbols(member.rows.slice(0, 20).map((r) => r.label.toUpperCase()));
    const top = member.rows.slice(0, 12);
    const isCoreIndexETF = (row: Row) =>
      /SPY|IVV|VOO|QQQ|DIA|VTI|SCHB|ITOT|^ONEQ$|NASDAQ-?100|S&P ?500|DOW/i.test(
        `${row.label} ${row.name}`
      );
    const isAnyETF = (row: Row) =>
      /\bETF\b|FUND|SPY|IVV|VOO|QQQ|DIA|VTI|IWM|XLF|XLE|XLK|XLV|XLY|XLP|IBIT|FBTC|BITB/i.test(
        `${row.label} ${row.name}`
      );
    const isHigherRiskETF = (row: Row) =>
      /IBIT|FBTC|BITB|ARKK|SOXL|TQQQ|SQQQ|LABU|LABD|UPRO|TECL/i.test(`${row.label} ${row.name}`);
    const isTechHeavyETF = (row: Row) => /QQQ|ONEQ|XLK|VGT|SMH|SOXX|IGV/i.test(`${row.label} ${row.name}`);
    const etfPct = top.filter(isAnyETF).reduce((sum, r) => sum + r.pct, 0);
    const coreIndexPct = top.filter(isCoreIndexETF).reduce((sum, r) => sum + r.pct, 0);
    const highRiskEtfPct = top.filter(isHigherRiskETF).reduce((sum, r) => sum + r.pct, 0);
    const techHeavyEtfPct = top.filter(isTechHeavyETF).reduce((sum, r) => sum + r.pct, 0);
    const top3 = member.rows.slice(0, 3).reduce((sum, r) => sum + r.pct, 0);

    const details = await Promise.all(
      top.map(async (row) => {
        try {
          const res = await fetch(`/api/stocks/${encodeURIComponent(row.label)}?interval=1M&newsLimit=1&newsOffset=0`);
          if (!res.ok) return null;
          const d = (await res.json()) as {
            sector?: string | null;
            industry?: string | null;
            metrics?: {
              marketCap?: number | null;
              beta?: number | null;
              trailingPE?: number | null;
              forwardPE?: number | null;
              pegRatio?: number | null;
              profitMargin?: number | null;
              returnOnEquity?: number | null;
              dividendYield?: number | null;
              priceToBook?: number | null;
              enterpriseToRevenue?: number | null;
              enterpriseToEbitda?: number | null;
              grossMargins?: number | null;
              operatingMargins?: number | null;
            };
          };
          return {
            pct: row.pct,
            sector: d.sector ?? null,
            industry: d.industry ?? null,
            marketCap: d.metrics?.marketCap ?? null,
            beta: d.metrics?.beta ?? null,
            pe: d.metrics?.trailingPE ?? null,
            forwardPE: d.metrics?.forwardPE ?? null,
            peg: d.metrics?.pegRatio ?? null,
            margin: d.metrics?.profitMargin ?? null,
            roe: d.metrics?.returnOnEquity ?? null,
            dividend: d.metrics?.dividendYield ?? null,
            pb: d.metrics?.priceToBook ?? null,
            evRev: d.metrics?.enterpriseToRevenue ?? null,
            evEbitda: d.metrics?.enterpriseToEbitda ?? null,
            grossMargin: d.metrics?.grossMargins ?? null,
            operatingMargin: d.metrics?.operatingMargins ?? null,
            symbol: row.label,
          };
        } catch {
          return null;
        }
      })
    );

    const valid = details.filter(Boolean) as Array<{
      pct: number;
      sector: string | null;
      industry: string | null;
      marketCap: number | null;
      beta: number | null;
      pe: number | null;
      forwardPE: number | null;
      peg: number | null;
      margin: number | null;
      roe: number | null;
      dividend: number | null;
      pb: number | null;
      evRev: number | null;
      evEbitda: number | null;
      grossMargin: number | null;
      operatingMargin: number | null;
      symbol: string;
    }>;
    const totalPct = Math.max(1, valid.reduce((sum, x) => sum + x.pct, 0));
    const weightedBetaNumerator = valid.reduce((sum, x) => sum + (x.beta ?? 1) * x.pct, 0);
    const weightedBeta = weightedBetaNumerator / totalPct;
    const avgPe = valid.reduce((sum, x) => sum + (x.pe ?? 0) * x.pct, 0) / totalPct;
    const avgForwardPe = valid.reduce((sum, x) => sum + (x.forwardPE ?? 0) * x.pct, 0) / totalPct;
    const weightedPeg = valid.reduce((sum, x) => sum + (x.peg ?? 0) * x.pct, 0) / totalPct;
    const weightedProfitMargin = valid.reduce((sum, x) => sum + (x.margin ?? 0) * x.pct, 0) / totalPct;
    const weightedRoe = valid.reduce((sum, x) => sum + (x.roe ?? 0) * x.pct, 0) / totalPct;
    const weightedDividendYield = valid.reduce((sum, x) => sum + (x.dividend ?? 0) * x.pct, 0) / totalPct;
    const weightedPriceToBook = valid.reduce((sum, x) => sum + (x.pb ?? 0) * x.pct, 0) / totalPct;
    const weightedEvToRevenue = valid.reduce((sum, x) => sum + (x.evRev ?? 0) * x.pct, 0) / totalPct;
    const weightedEvToEbitda = valid.reduce((sum, x) => sum + (x.evEbitda ?? 0) * x.pct, 0) / totalPct;
    const weightedGrossMargin = valid.reduce((sum, x) => sum + (x.grossMargin ?? 0) * x.pct, 0) / totalPct;
    const weightedOperatingMargin = valid.reduce((sum, x) => sum + (x.operatingMargin ?? 0) * x.pct, 0) / totalPct;
    const largeCapPct = valid.filter((x) => (x.marketCap ?? 0) >= 10_000_000_000).reduce((s, x) => s + x.pct, 0);
    const smallCapPct = valid.filter((x) => (x.marketCap ?? 0) > 0 && (x.marketCap ?? 0) < 2_000_000_000).reduce((s, x) => s + x.pct, 0);
    const industryMap = new Map<string, number>();
    for (const x of valid) {
      const key = (x.industry || x.sector || "").trim();
      if (!key || /^unknown$/i.test(key)) continue;
      industryMap.set(key, (industryMap.get(key) ?? 0) + x.pct);
    }
    const topIndustries = [...industryMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => k);

    let riskScore = 50;
    if (smallCapPct > 30) riskScore += 16;
    else if (smallCapPct > 20) riskScore += 8;
    if (largeCapPct > 60) riskScore -= 10;
    if (coreIndexPct > 55) riskScore -= 12;
    else if (coreIndexPct > 35) riskScore -= 6;
    if (highRiskEtfPct > 8) riskScore += 16;
    if (techHeavyEtfPct > 25) riskScore += 8;
    if (top3 > 65) riskScore += 14;
    else if (top3 > 50) riskScore += 8;
    if (weightedBeta > 1.25) riskScore += 8;
    else if (weightedBeta < 0.95) riskScore -= 6;
    riskScore = Math.max(5, Math.min(95, Math.round(riskScore)));
    const riskTolerance =
      riskScore >= 70
        ? "Higher risk"
        : riskScore >= 52
          ? "Moderate risk"
          : "Lower risk";
    const concentration =
      top3 > 65 ? "Highly concentrated (top 3 positions dominate)." : top3 > 45 ? "Moderately concentrated." : "Well-diversified across positions.";
    const capTilt =
      largeCapPct > 55
        ? `Large-cap tilted (${largeCapPct.toFixed(1)}% large cap).`
        : smallCapPct > 30
          ? `Meaningful small-cap tilt (${smallCapPct.toFixed(1)}% small cap).`
          : "Mixed market-cap exposure.";
    const topHoldings = member.rows
      .slice(0, 5)
      .map((r) => ({ symbol: r.label, pct: r.pct }));

    setInsight({
      title: "Portfolio Analysis",
      riskTolerance,
      concentration,
      capTilt,
      etfConcentration:
        etfPct > 35
          ? `High ETF concentration (${etfPct.toFixed(1)}%), with ${highRiskEtfPct.toFixed(1)}% in higher-volatility ETF sleeves.`
          : `ETF concentration is ${etfPct.toFixed(1)}%, with ${highRiskEtfPct.toFixed(1)}% in higher-volatility ETF sleeves.`,
      indexConcentration:
        coreIndexPct > 45
          ? `Core index exposure is heavy (${coreIndexPct.toFixed(1)}% in broad index ETFs), which generally lowers single-name risk.`
          : `Core index ETF exposure is ${coreIndexPct.toFixed(1)}%.`,
      mainIndustries: topIndustries,
      riskScore,
      weightedBeta: Number.isFinite(weightedBeta) ? weightedBeta : null,
      avgPe: Number.isFinite(avgPe) ? avgPe : null,
      avgForwardPe: Number.isFinite(avgForwardPe) ? avgForwardPe : null,
      weightedPeg: Number.isFinite(weightedPeg) ? weightedPeg : null,
      weightedProfitMargin: Number.isFinite(weightedProfitMargin) ? weightedProfitMargin : null,
      weightedRoe: Number.isFinite(weightedRoe) ? weightedRoe : null,
      weightedDividendYield: Number.isFinite(weightedDividendYield) ? weightedDividendYield : null,
      weightedPriceToBook: Number.isFinite(weightedPriceToBook) ? weightedPriceToBook : null,
      weightedEvToRevenue: Number.isFinite(weightedEvToRevenue) ? weightedEvToRevenue : null,
      weightedEvToEbitda: Number.isFinite(weightedEvToEbitda) ? weightedEvToEbitda : null,
      weightedGrossMargin: Number.isFinite(weightedGrossMargin) ? weightedGrossMargin : null,
      weightedOperatingMargin: Number.isFinite(weightedOperatingMargin) ? weightedOperatingMargin : null,
      topHoldings,
    });
    setAnalyzingUserId(null);
  }

  useEffect(() => {
    let cancelled = false;
    async function loadMovers() {
      if (!insightOpen || analyzedSymbols.length === 0) {
        setMovers([]);
        return;
      }
      setMoversLoading(true);
      try {
        const rows = await Promise.all(
          analyzedSymbols.map(async (sym) => {
            try {
              const res = await fetch(`/api/stocks/${encodeURIComponent(sym)}?interval=${analyzeInterval}`);
              const d = (await res.json().catch(() => ({}))) as { changePct?: number | null };
              if (!res.ok || typeof d.changePct !== "number" || !Number.isFinite(d.changePct)) return null;
              return { symbol: sym, changePct: d.changePct };
            } catch {
              return null;
            }
          })
        );
        if (!cancelled) setMovers(rows.filter((x): x is { symbol: string; changePct: number } => Boolean(x)));
      } finally {
        if (!cancelled) setMoversLoading(false);
      }
    }
    void loadMovers();
    return () => {
      cancelled = true;
    };
  }, [insightOpen, analyzedSymbols, analyzeInterval]);

  if (err && !data) return <div><p className="text-red-600">{err}</p><Link href="/arena" className="text-(--accent)">Back</Link></div>;
  if (!data) return <p className="text-(--muted)">Loading...</p>;

  return (
    <div className="min-w-0 space-y-4">
      <div className="min-w-0">
        <Link href="/arena" className="text-sm text-(--accent)">← All arenas</Link>
        <h1 className="mt-1 break-words bg-linear-to-r from-cyan-200 via-sky-200 to-violet-200 bg-clip-text text-xl font-semibold text-transparent sm:text-2xl">{data.arena.name}</h1>
        <p className="text-slate-300 text-sm">
          Invite code: <code className="break-all font-mono">{data.arena.joinCode}</code>
        </p>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}

      {data.arena.isCreator && (
        <div className="rounded-xl border border-cyan-400/35 bg-gradient-to-br from-slate-900/95 to-indigo-900/65 p-3 shadow-lg shadow-cyan-700/20">
          <form onSubmit={renameArena} className="flex flex-wrap items-center gap-2">
            <input className="rounded border border-cyan-400/30 bg-slate-900/85 px-2 py-1.5 text-sm" value={rename} onChange={(e) => setRename(e.target.value)} />
            <button type="submit" className="rounded bg-cyan-500/80 px-3 py-1.5 text-sm text-slate-950 hover:bg-cyan-400">Rename</button>
            <button type="button" onClick={() => void deleteArena()} className="rounded border border-red-500/40 px-3 py-1.5 text-sm text-red-500">Delete arena</button>
          </form>
        </div>
      )}

      <section className="rounded-xl border border-sky-400/35 bg-gradient-to-br from-slate-900/95 to-slate-800/80 p-3 shadow-lg shadow-sky-700/20">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Members</h2>
          <button
            type="button"
            onClick={() => {
              setMemberSort((s) => (s === "name" ? "topPct" : "name"));
              setMemberSortDir((d) => (d === "asc" ? "desc" : "asc"));
            }}
            className="text-xs text-(--muted)"
          >
            Sort
          </button>
        </div>
        <ul className="grid max-h-[360px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-4">
          {sortedMembers.map((p) => {
            const who = p.user.name || p.user.email.split("@")[0];
            const active = p.user.id === selectedUserId;
            return (
              <li key={p.user.id} className={"rounded-2xl border p-3 " + (active ? "border-cyan-400/60 bg-cyan-500/10" : "border-(--card-border) bg-black/20")}>
                <button type="button" onClick={() => setSelectedUserId(p.user.id)} className="w-full text-left">
                  <p className="font-medium">{who}</p>
                </button>
                {data.arena.isCreator && p.user.id !== data.arena.meId && (
                  <button type="button" onClick={() => void removeMember(p.user.id)} className="mt-2 rounded border border-red-500/35 px-2 py-1 text-xs text-red-500">Remove user</button>
                )}
              </li>
            );
          })}
        </ul>
      </section>
      <style jsx>{`
        @keyframes arenaTicker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>

      {selected && me && (
        <section className="space-y-4 rounded-2xl border border-cyan-400/35 bg-gradient-to-br from-slate-900/95 to-indigo-900/70 p-4 shadow-xl shadow-cyan-700/20">
          {!arenaOverview ? (
            <p className="text-sm text-(--muted)">Building arena ticker…</p>
          ) : arenaOverview.badges.length === 0 ? (
            <p className="text-sm text-(--muted)">No badges yet. Add holdings and refresh once quotes load.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-cyan-400/25 bg-slate-900/70 py-2">
              <div
                className="flex min-w-max items-center gap-3 px-2 motion-safe:animate-[arenaTicker_45s_linear_infinite]"
                style={{ animationDuration: `${Math.max(28, arenaOverview.badges.length * 5)}s` }}
              >
                {[...arenaOverview.badges, ...arenaOverview.badges].map((b, idx) => (
                  <div
                    key={`${b.key}-${idx}`}
                    className="flex min-w-[290px] items-center gap-2 rounded-lg border border-cyan-400/25 bg-slate-900/85 px-3 py-2 shadow-sm"
                    title={b.detail}
                  >
                    <span className="text-base leading-none" aria-hidden>
                      {b.emoji}
                    </span>
                    <p className="truncate text-xs">
                      <span className="font-semibold text-(--muted)">{b.title}:</span>{" "}
                      <span className="font-semibold text-foreground">{b.winner}</span>{" "}
                      <span className="text-(--muted)">- {b.detail}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <h2 className="text-lg font-semibold break-words sm:text-xl">Compare with {selected.user.name || selected.user.email.split("@")[0]}</h2>
          <div className="grid min-w-0 items-stretch gap-4 xl:grid-cols-12">
            <div className="min-w-0 xl:col-span-9 rounded-xl border border-cyan-400/30 bg-slate-900/70 p-3 min-h-0 xl:min-h-[520px]">
              <div className="grid h-full min-w-0 gap-6 lg:grid-cols-[1fr_auto_1fr] lg:gap-4">
                <div className="min-w-0">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-medium text-(--muted)">Your portfolio % mix</h3>
                    <button
                      type="button"
                      onClick={() => void analyzePortfolio(me)}
                      disabled={analyzingUserId === me.user.id}
                      className="rounded-md border border-cyan-400/35 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-50"
                    >
                      {analyzingUserId === me.user.id ? "Analyzing..." : "Analyze"}
                    </button>
                  </div>
                  <HoldingPie holdings={toPieHoldings(me.rows)} height={arenaPieHeight} showDollar={false} />
                </div>
                <div className="mx-auto hidden w-px shrink-0 bg-(--card-border) lg:block" style={{ height: arenaPieHeight }} aria-hidden />
                <div className="min-w-0">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-medium text-(--muted)">{selected.user.name || selected.user.email.split("@")[0]} portfolio % mix</h3>
                    <button
                      type="button"
                      onClick={() => void analyzePortfolio(selected)}
                      disabled={analyzingUserId === selected.user.id}
                      className="rounded-md border border-cyan-400/35 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-50"
                    >
                      {analyzingUserId === selected.user.id ? "Analyzing..." : "Analyze"}
                    </button>
                  </div>
                  <HoldingPie holdings={toPieHoldings(selected.rows)} height={arenaPieHeight} showDollar={false} />
                </div>
              </div>
            </div>

            <div className="flex min-h-0 flex-col xl:col-span-3 xl:min-h-[520px] rounded-xl border border-violet-400/30 bg-slate-900/70 p-3">
              <div className="flex shrink-0 rounded-lg border border-violet-400/30 bg-black/20 p-0.5">
                <button
                  type="button"
                  onClick={() => setRightColumnTab("feed")}
                  className={
                    "flex-1 rounded-md px-2 py-2 text-center text-xs font-medium transition " +
                    (rightColumnTab === "feed" ? "bg-(--accent) text-(--accent-foreground)" : "text-(--muted) hover:text-foreground")
                  }
                >
                  Investing feed
                </button>
                <button
                  type="button"
                  onClick={() => setRightColumnTab("votes")}
                  className={
                    "flex-1 rounded-md px-2 py-2 text-center text-xs font-medium transition " +
                    (rightColumnTab === "votes" ? "bg-(--accent) text-(--accent-foreground)" : "text-(--muted) hover:text-foreground")
                  }
                >
                  Conviction votes
                </button>
              </div>
              <div className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden">
                {rightColumnTab === "feed" ? (
                  <>
                    <h3 className="mb-2 text-sm font-medium text-(--muted)">Updates for {selected.user.name || selected.user.email.split("@")[0]}</h3>
                    <div className="max-h-[450px] space-y-2 overflow-y-auto pr-1">
                      {selectedFeed.length === 0 ? (
                        <p className="text-sm text-(--muted)">No recent updates.</p>
                      ) : (
                        selectedFeed.map((f) => (
                          <div key={f.id} className="rounded-lg border border-violet-400/20 bg-black/20 px-2 py-1.5 text-xs">
                            {formatPctChangeLine({
                              userLabel: f.user.name || f.user.email.split("@")[0],
                              symbol: f.symbol,
                              title: f.title,
                              kind: f.kind,
                              pct: f.pct,
                              oldShares: f.oldShares,
                              newShares: f.newShares,
                              at: f.createdAt,
                              accountName: undefined,
                            })}
                          </div>
                        ))
                      )}
                    </div>
                  </>
                ) : (
                  <ArenaConvictionPanel
                    arenaId={data.arena.id}
                    tickers={arenaTickerUniverse}
                    externalSymbol={voteJumpSymbol}
                    onExternalSymbolConsumed={() => setVoteJumpSymbol(null)}
                    embedded
                  />
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-5">
            <div className="rounded-xl border border-sky-400/30 bg-slate-900/70 p-3 xl:col-span-1 min-h-[332px]">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="font-medium">Their Holdings</h4>
                <button type="button" onClick={() => setOtherSortDir((d) => (d === "asc" ? "desc" : "asc"))} className="text-xs text-(--muted)">
                  {otherSortDir === "asc" ? "A-Z" : "%"}
                </button>
              </div>
              <div className="max-h-[280px] overflow-y-auto pr-1">
                <div className="mb-1 grid grid-cols-[1fr_auto] text-[11px] uppercase tracking-wide text-(--muted)">
                  <span className="text-left">Ticker</span>
                  <span className="text-right">Weight</span>
                </div>
                <ul className="space-y-0.5 text-xs">
                  {otherHoldings.slice(0, 50).map((r) => (
                    <li key={r.label} className="grid grid-cols-[1fr_auto] items-center border-b border-(--card-border)/50 py-1">
                      <TickerSymbol
                        symbol={r.label}
                        onInteract={() => {
                          setRightColumnTab("votes");
                          setVoteJumpSymbol(r.label);
                        }}
                        className="justify-self-start text-left font-mono underline-offset-2 hover:underline"
                      />
                      <span className="justify-self-end">{r.pct.toFixed(1)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 shadow-sm xl:col-span-1 min-h-[332px]">
              <h4 className="font-medium text-emerald-200">Shared tickers</h4>
              {sharedWithPct.length === 0 ? (
                <p className="mt-2 text-sm text-(--muted)">None yet.</p>
              ) : (
                <div className="mt-2 space-y-1 text-xs">
                  {sharedWithPct.map((row) => (
                    <div key={row.ticker} className="space-y-1 rounded-lg border border-emerald-500/15 px-2 py-1.5 sm:grid sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:gap-2 sm:border-0 sm:px-0 sm:py-0">
                      <TickerSymbol
                        symbol={row.ticker}
                        onInteract={() => {
                          setRightColumnTab("votes");
                          setVoteJumpSymbol(row.ticker);
                        }}
                        className="min-w-0 justify-self-start text-left font-mono underline-offset-2 hover:underline"
                      />
                      <div className="flex justify-between gap-2 text-[11px] sm:contents sm:text-xs">
                        <span className={"tabular-nums " + (row.mePct >= row.otherPct ? "text-emerald-300" : "text-(--muted)")}>
                          You {row.mePct.toFixed(1)}%
                        </span>
                        <span className={"tabular-nums " + (row.otherPct > row.mePct ? "text-emerald-300" : "text-(--muted)")}>
                          Them {row.otherPct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-violet-400/30 bg-slate-900/70 p-3 xl:col-span-3">
              <h4 className="font-medium">{data.arena.name} Group Chat</h4>
              <div className="mt-2 max-h-[360px] space-y-2 overflow-y-auto pr-1">
                {chat.length === 0 ? (
                  <p className="text-sm text-(--muted)">No messages yet.</p>
                ) : (
                  chat.map((m) => (
                    <div key={m.id} className={"flex " + (m.sender.id === data.arena.meId ? "justify-end pr-4" : "justify-start pl-4")}>
                      <div className={"max-w-[min(92%,20rem)] rounded-2xl px-3 py-2 text-sm sm:max-w-[86%] " + (m.sender.id === data.arena.meId ? "bg-cyan-500/80 text-slate-950" : "border border-violet-400/25 bg-black/25")}>
                        <p className="text-[10px] opacity-70">
                          {(m.sender.name || m.sender.email.split("@")[0])} · {new Date(m.createdAt).toLocaleString()}
                        </p>
                        <p className="mt-1">{m.body}</p>
                        {m.shareUrl ? (
                          <a href={m.shareUrl} className="mt-1 inline-block text-xs underline" target="_blank" rel="noreferrer">
                            Open shared link
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <form onSubmit={sendArenaChat} className="mt-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  value={chatDraft}
                  onChange={(e) => setChatDraft(e.target.value)}
                  className="min-h-11 min-w-0 flex-1 rounded-md border border-violet-400/30 bg-slate-900/85 px-3 py-2 text-sm"
                  placeholder="Message arena..."
                />
                <button type="submit" className="min-h-11 shrink-0 rounded-md border border-cyan-400/35 bg-cyan-500/80 px-4 py-2 text-sm text-slate-950 hover:bg-cyan-400 sm:self-stretch">
                  Send
                </button>
              </form>
            </div>
          </div>
        </section>
      )}
      {insightOpen && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4">
          <div className="pointer-events-auto scrollbar-hide mt-auto max-h-[min(92dvh,920px)] w-full overflow-y-auto overscroll-y-contain rounded-t-2xl border border-cyan-500/30 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/80 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl sm:mt-0 sm:max-w-4xl sm:rounded-2xl sm:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="bg-linear-to-r from-sky-300 to-violet-300 bg-clip-text text-xl font-semibold text-transparent">
                {insight?.title ?? "Portfolio Analysis"}
              </h3>
              <button
                type="button"
                onClick={() => setInsightOpen(false)}
                className="rounded-md border border-(--card-border) px-2 py-1 text-xs hover:bg-(--background)"
              >
                Close
              </button>
            </div>
            {!insight ? (
              <p className="text-sm text-(--muted)">Pulling allocation context, sector mix, and risk profile...</p>
            ) : (
              <div className="grid gap-2 text-sm md:grid-cols-2">
                <div className="rounded-xl border border-cyan-500/35 bg-cyan-500/10 p-3">
                  <p className="text-xs font-semibold text-cyan-200">
                    Top 5 holdings <MiniInfo text="Top positions by portfolio weight in this selected account, shown as percentages only." />
                  </p>
                  <ul className="mt-2 space-y-1">
                    {insight.topHoldings.map((h) => (
                      <li key={h.symbol} className="flex items-center justify-between rounded-md border border-cyan-500/20 bg-black/20 px-2 py-1">
                        <span className="font-mono">{h.symbol}</span>
                        <span>{h.pct.toFixed(1)}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-violet-500/35 bg-violet-500/10 p-3">
                  <p className="text-xs font-semibold text-violet-200">
                    Volatility and exposure
                    <MiniInfo text="Volatility profile is derived from weighted beta: High if above 1.20, Low if below 0.95, otherwise Moderate." />
                  </p>
                  <p className="mt-2 text-sm">Risk score: <span className="font-semibold">{insight.riskScore}/100</span></p>
                  <p className="text-sm">Beta-weighted: <span className="font-semibold">{insight.weightedBeta != null ? insight.weightedBeta.toFixed(2) : "—"}</span></p>
                  <p className="text-sm">Profile: <span className="font-semibold">{insight.riskTolerance}</span></p>
                  <p className="mt-2 text-xs text-(--muted)">No dollar amounts shown in arena analysis.</p>
                </div>
                <div className="rounded-xl border border-zinc-500/30 bg-zinc-500/10 p-3">
                  <p className="text-xs text-zinc-200">
                    Valuation <MiniInfo text="Weighted valuation ratios based on position size within the selected portfolio." />
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div className="rounded-md border border-(--card-border) bg-(--background) p-2 text-center text-[11px]">Forward P/E <MiniInfo text="Price divided by expected next-12-month earnings." /><br /><span className="text-sm font-semibold">{insight.avgForwardPe != null ? insight.avgForwardPe.toFixed(1) : "—"}</span></div>
                    <div className="rounded-md border border-(--card-border) bg-(--background) p-2 text-center text-[11px]">P/E <MiniInfo text="Price divided by trailing earnings per share." /><br /><span className="text-sm font-semibold">{insight.avgPe != null ? insight.avgPe.toFixed(1) : "—"}</span></div>
                    <div className="rounded-md border border-(--card-border) bg-(--background) p-2 text-center text-[11px]">P/B <MiniInfo text="Price relative to book value per share." /><br /><span className="text-sm font-semibold">{insight.weightedPriceToBook != null ? insight.weightedPriceToBook.toFixed(2) : "—"}</span></div>
                    <div className="rounded-md border border-(--card-border) bg-(--background) p-2 text-center text-[11px]">EV/EBITDA <MiniInfo text="Enterprise value divided by EBITDA." /><br /><span className="text-sm font-semibold">{insight.weightedEvToEbitda != null ? insight.weightedEvToEbitda.toFixed(1) : "—"}</span></div>
                  </div>
                </div>
                <div className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 p-3">
                  <p className="text-xs text-fuchsia-200">
                    Core weighted metrics <MiniInfo text="Additional weighted quality and growth metrics for the selected account." />
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div className="rounded-md border border-(--card-border) bg-(--background) p-2 text-center text-[11px]">PEG <MiniInfo text="P/E divided by expected earnings growth." /><br /><span className="text-sm font-semibold">{insight.weightedPeg != null ? insight.weightedPeg.toFixed(2) : "—"}</span></div>
                    <div className="rounded-md border border-(--card-border) bg-(--background) p-2 text-center text-[11px]">Div Yield <MiniInfo text="Annual dividend yield weighted by portfolio position size." /><br /><span className="text-sm font-semibold">{insight.weightedDividendYield != null ? `${insight.weightedDividendYield.toFixed(2)}%` : "—"}</span></div>
                    <div className="rounded-md border border-(--card-border) bg-(--background) p-2 text-center text-[11px]">EV/Revenue <MiniInfo text="Enterprise value divided by revenue." /><br /><span className="text-sm font-semibold">{insight.weightedEvToRevenue != null ? insight.weightedEvToRevenue.toFixed(2) : "—"}</span></div>
                    <div className="rounded-md border border-(--card-border) bg-(--background) p-2 text-center text-[11px]">ROE <MiniInfo text="Return on equity weighted by position size." /><br /><span className="text-sm font-semibold">{insight.weightedRoe != null ? `${(insight.weightedRoe * 100).toFixed(1)}%` : "—"}</span></div>
                  </div>
                </div>
                <div className="rounded-xl border border-(--card-border) bg-(--background) p-3 md:col-span-2">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-(--muted)">
                      Top movers <MiniInfo text="Best and worst performers among the top holdings for the selected timeframe." />
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {ANALYZE_INTERVALS.map((iv) => (
                        <button
                          key={iv}
                          type="button"
                          onClick={() => setAnalyzeInterval(iv)}
                          className={
                            "rounded-md px-2 py-1 text-[11px] " +
                            (analyzeInterval === iv
                              ? "bg-(--accent) text-(--accent-foreground)"
                              : "border border-(--card-border) hover:bg-(--card)")
                          }
                        >
                          {iv}
                        </button>
                      ))}
                    </div>
                  </div>
                  {moversLoading ? (
                    <p className="text-sm text-(--muted)">Loading movers…</p>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="mb-1 text-xs text-emerald-300">Largest % gainers ({analyzeInterval})</p>
                        <ul className="space-y-1">
                          {[...movers].sort((a, b) => b.changePct - a.changePct).slice(0, 5).map((m) => (
                            <li key={`g-${m.symbol}`} className="flex items-center justify-between rounded-md border border-emerald-500/20 px-2 py-1 text-sm">
                              <span className="font-mono">{m.symbol}</span>
                              <span className="text-emerald-300">{m.changePct > 0 ? "+" : ""}{m.changePct.toFixed(2)}%</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="mb-1 text-xs text-rose-300">Largest % losers ({analyzeInterval})</p>
                        <ul className="space-y-1">
                          {[...movers].sort((a, b) => a.changePct - b.changePct).slice(0, 5).map((m) => (
                            <li key={`l-${m.symbol}`} className="flex items-center justify-between rounded-md border border-rose-500/20 px-2 py-1 text-sm">
                              <span className="font-mono">{m.symbol}</span>
                              <span className="text-rose-300">{m.changePct.toFixed(2)}%</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
