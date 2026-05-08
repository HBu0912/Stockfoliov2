"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { HoldingPie } from "@/components/HoldingPie";
import { HoldingsTable } from "@/components/HoldingsTable";
import { AtlasChat } from "@/components/AtlasChat";
import { formatPctChangeLine } from "@/lib/feed-copy";
import { formatNumber } from "@/lib/money";
import type { Account, AccountFeedEvent, Holding } from "@prisma/client";

type A = Account & { holdings: Holding[] };
type GlobalFeedRow = {
  id: string;
  symbol: string;
  title: string;
  kind: string;
  pct: number;
  oldShares: number;
  newShares: number;
  accountName: string | null;
  createdAt: string;
  user: { name: string | null; email: string };
};

function Info({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-(--card-border) text-[10px] text-(--muted)">
      i
      <span className="pointer-events-none absolute right-0 top-5 z-20 hidden w-60 rounded-md border border-(--card-border) bg-(--background) p-2 text-xs text-(--muted) shadow-lg group-hover:block">
        {text}
      </span>
    </span>
  );
}

export default function AccountDetailPage() {
  const { id } = useParams() as { id: string };
  const [account, setAccount] = useState<A | null>(null);
  const [feed, setFeed] = useState<AccountFeedEvent[]>([]);
  const [globalFeed, setGlobalFeed] = useState<GlobalFeedRow[]>([]);
  const [analysis, setAnalysis] = useState<{
    weightedBeta: number | null;
    avgPe: number | null;
    avgForwardPe: number | null;
    weightedPeg: number | null;
    weightedProfitMargin: number | null;
    weightedRoe: number | null;
    weightedDividendYield: number | null;
    strengths: string[];
    weaknesses: string[];
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [userName, setUserName] = useState("there");

  const load = useCallback(async () => {
    setErr(null);
    const r = await fetch(`/api/accounts/${id}`);
    if (!r.ok) {
      setErr("Not found or no access");
      return;
    }
    const d = (await r.json()) as { account: A };
    setAccount(d.account);
    const fr = await fetch(`/api/feed/account/${id}`);
    if (fr.ok) {
      const fd = (await fr.json()) as { items: AccountFeedEvent[] };
      setFeed(fd.items);
    }
    const gr = await fetch("/api/feed");
    if (gr.ok) {
      const gd = (await gr.json()) as { items: GlobalFeedRow[] };
      setGlobalFeed(gd.items.filter((x) => x.accountName === d.account.name));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    async function loadMe() {
      const res = await fetch("/api/auth/me");
      if (!res.ok) return;
      const data = (await res.json()) as { user?: { name?: string | null; email?: string } | null };
      if (cancelled || !data.user) return;
      setUserName(data.user.name?.trim() || data.user.email?.split("@")[0] || "there");
    }
    void loadMe();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const fn = () => {
      void load();
    };
    window.addEventListener("prices-refreshed", fn);
    return () => window.removeEventListener("prices-refreshed", fn);
  }, [load]);

  const total = account ? account.holdings.reduce((s, h) => s + h.shares * (h.lastPrice ?? 0), 0) : 0;

  useEffect(() => {
    let cancelled = false;
    async function loadAnalysis() {
      if (!account?.holdings?.length) {
        setAnalysis(null);
        return;
      }
      const top = [...account.holdings]
        .sort((a, b) => (b.shares * (b.lastPrice ?? 0)) - (a.shares * (a.lastPrice ?? 0)))
        .slice(0, 8);
      const totalValue = Math.max(1, top.reduce((s, h) => s + h.shares * (h.lastPrice ?? 0), 0));
      const details = await Promise.all(
        top.map(async (h) => {
          const isCoreIndex = /SPY|IVV|VOO|QQQ|DIA|VTI|SCHB|ITOT|ONEQ|NASDAQ|S&P|DOW/i.test(`${h.symbol} ${h.name ?? ""}`);
          try {
            const res = await fetch(`/api/stocks/${encodeURIComponent(h.symbol)}?interval=1M&newsLimit=1&newsOffset=0`);
            if (!res.ok) return null;
            const d = (await res.json()) as {
              metrics?: {
                beta?: number | null;
                trailingPE?: number | null;
                forwardPE?: number | null;
                pegRatio?: number | null;
                profitMargin?: number | null;
                returnOnEquity?: number | null;
                dividendYield?: number | null;
              };
            };
            const weight = ((h.shares * (h.lastPrice ?? 0)) / totalValue) * 100;
            return {
              weight,
              coreIndex: isCoreIndex,
              beta: d.metrics?.beta ?? null,
              pe: d.metrics?.trailingPE ?? null,
              forwardPE: d.metrics?.forwardPE ?? null,
              peg: d.metrics?.pegRatio ?? null,
              margin: d.metrics?.profitMargin ?? null,
              roe: d.metrics?.returnOnEquity ?? null,
              dividend: d.metrics?.dividendYield ?? null,
              symbol: h.symbol,
            };
          } catch {
            return null;
          }
        })
      );
      if (cancelled) return;
      const valid = details.filter(Boolean) as Array<{
        weight: number;
        coreIndex: boolean;
        beta: number | null;
        pe: number | null;
        forwardPE: number | null;
        peg: number | null;
        margin: number | null;
        roe: number | null;
        dividend: number | null;
        symbol: string;
      }>;
      const w = Math.max(1, valid.reduce((s, x) => s + x.weight, 0));
      const weightedBeta = valid.reduce((s, x) => s + (x.beta ?? 1) * x.weight, 0) / w;
      const avgPe = valid.reduce((s, x) => s + (x.pe ?? 0) * x.weight, 0) / w;
      const avgForwardPe = valid.reduce((s, x) => s + (x.forwardPE ?? 0) * x.weight, 0) / w;
      const weightedPeg = valid.reduce((s, x) => s + (x.peg ?? 0) * x.weight, 0) / w;
      const weightedProfitMargin = valid.reduce((s, x) => s + (x.margin ?? 0) * x.weight, 0) / w;
      const weightedRoe = valid.reduce((s, x) => s + (x.roe ?? 0) * x.weight, 0) / w;
      const weightedDividendYield = valid.reduce((s, x) => s + (x.dividend ?? 0) * x.weight, 0) / w;
      const indexEtfPct = valid.filter((x) => x.coreIndex).reduce((s, x) => s + x.weight, 0);
      const top3 = top.slice(0, 3).reduce((s, h) => s + ((h.shares * (h.lastPrice ?? 0)) / totalValue) * 100, 0);
      const topNames = top.slice(0, 3).map((h) => h.symbol);
      const strengths: string[] = [];
      const weaknesses: string[] = [];
      if (indexEtfPct >= 45) strengths.push(`Core-index ETF exposure near ${formatNumber(indexEtfPct, 1)}% creates broad diversification even with fewer single-name positions.`);
      if (weightedBeta < 1.1) strengths.push(`Weighted beta around ${formatNumber(weightedBeta, 2)} indicates tempered volatility versus broad market swings.`);
      if (avgForwardPe > 0 && avgForwardPe < 25) strengths.push(`Forward valuation around ${formatNumber(avgForwardPe, 1)}x remains within a reasonable range for mixed growth/value exposure.`);
      if (weightedProfitMargin > 0.12 || weightedRoe > 0.14) strengths.push(`Quality metrics are supportive (margin ${formatNumber(weightedProfitMargin * 100, 1)}%, ROE ${formatNumber(weightedRoe * 100, 1)}%).`);
      if (top3 > 62 && indexEtfPct < 35) weaknesses.push(`Concentration is high in ${topNames.join(", ")}, and limited index ballast can amplify single-theme risk.`);
      if (weightedBeta > 1.3) weaknesses.push(`Risk/volatility profile is elevated (beta ${formatNumber(weightedBeta, 2)}), so drawdowns can be steeper during market stress.`);
      if (avgForwardPe > 35 || weightedPeg > 2.2) weaknesses.push(`Valuation setup is sensitive (forward P/E ${formatNumber(avgForwardPe, 1)}x, PEG ${formatNumber(weightedPeg, 2)}), requiring strong execution.`);
      if (!strengths.length) strengths.push("No dominant structural strength identified from current top holdings.");
      if (!weaknesses.length) weaknesses.push("No dominant structural weakness identified from current top holdings.");
      setAnalysis({
        weightedBeta,
        avgPe,
        avgForwardPe,
        weightedPeg,
        weightedProfitMargin,
        weightedRoe,
        weightedDividendYield,
        strengths: strengths.slice(0, 4),
        weaknesses: weaknesses.slice(0, 4),
      });
    }
    void loadAnalysis();
    return () => {
      cancelled = true;
    };
  }, [account]);

  async function editHolding(holdingId: string, nextShares: number) {
    const r = await fetch(`/api/holdings/${holdingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shares: nextShares }),
    });
    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      setErr(d.error ?? "Update failed");
      return;
    }
    await load();
  }

  async function removeHolding(holdingId: string) {
    if (!confirm("Remove this line? The feed will record a position change (including full exit if you move to 0).")) return;
    const r = await fetch(`/api/holdings/${holdingId}`, { method: "DELETE" });
    if (!r.ok) {
      setErr("Could not remove");
      return;
    }
    await load();
  }

  if (err && !account) {
    return (
      <div>
        <p className="text-red-600">{err}</p>
        <Link href="/overview" className="text-(--accent)">
          Back
        </Link>
      </div>
    );
  }
  if (!account) {
    return <p className="text-(--muted)">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/overview" className="text-sm text-(--accent)">
          ← Overview
        </Link>
        <div className="mt-1 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{account.name}</h1>
          <AtlasChat
            accountLabel={account.name}
            holdings={account.holdings}
            userName={userName}
            buttonClassName="rounded-md border border-(--card-border) px-2.5 py-1.5 text-xs text-(--muted) hover:bg-(--background)"
          />
        </div>
        <p className="text-(--muted) text-sm">This account&rsquo;s own activity (position % — not the rest of your portfolio)</p>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}

      <section className="grid gap-4 md:grid-cols-2">
        <div>
          <h2 className="text-sm font-medium text-(--muted)">Allocation mix</h2>
          <HoldingPie holdings={account.holdings} height={320} />
        </div>
        <div>
          <h2 className="text-sm font-medium text-(--muted)">Account value</h2>
          <p className="text-2xl font-semibold tabular-nums">
            {total.toLocaleString("en-US", { style: "currency", currency: "USD" })}
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium">Holdings</h2>
        <div className="mt-2">
          <HoldingsTable
            holdings={account.holdings}
            accountTotal={total}
            onEditShares={editHolding}
            onRemove={removeHolding}
          />
        </div>
      </section>
      <section className="rounded-xl border border-(--card-border) bg-(--card) p-3">
        <h2 className="text-lg font-medium">Portfolio Analysis</h2>
        {!analysis ? (
          <p className="mt-2 text-sm text-(--muted)">Loading account analysis...</p>
        ) : (
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-(--card-border) bg-(--background) p-2.5">
              <p className="flex items-center justify-between gap-2 text-xs text-(--muted)">
                Weighted Avg Beta
                <Info text="Beta of 1 tracks the market. Above 1 tends to be more volatile; below 1 tends to be less volatile." />
              </p>
              <p className="text-xl font-semibold">{analysis.weightedBeta != null ? analysis.weightedBeta.toFixed(2) : "—"}</p>
            </div>
            <div className="rounded-lg border border-(--card-border) bg-(--background) p-2.5">
              <p className="flex items-center justify-between gap-2 text-xs text-(--muted)">
                Weighted Avg P/E
                <Info text="Trailing P/E compares price to last-12-month earnings. Higher values imply richer valuation expectations." />
              </p>
              <p className="text-xl font-semibold">{analysis.avgPe != null ? analysis.avgPe.toFixed(1) : "—"}</p>
            </div>
            <div className="rounded-lg border border-(--card-border) bg-(--background) p-2.5">
              <p className="flex items-center justify-between gap-2 text-xs text-(--muted)">
                Weighted Avg Forward P/E
                <Info text="Forward P/E compares price to next-year expected earnings. Higher values increase valuation sensitivity." />
              </p>
              <p className="text-xl font-semibold">{analysis.avgForwardPe != null ? analysis.avgForwardPe.toFixed(1) : "—"}</p>
            </div>
            <div className="rounded-lg border border-(--card-border) bg-(--background) p-2.5">
              <p className="text-xs text-(--muted)">Weighted PEG</p>
              <p className="text-xl font-semibold">{analysis.weightedPeg != null ? analysis.weightedPeg.toFixed(2) : "—"}</p>
            </div>
            <div className="rounded-lg border border-(--card-border) bg-(--background) p-2.5">
              <p className="text-xs text-(--muted)">Weighted Margin / ROE</p>
              <p className="text-xl font-semibold">
                {analysis.weightedProfitMargin != null ? `${formatNumber(analysis.weightedProfitMargin * 100, 1)}%` : "—"} / {analysis.weightedRoe != null ? `${formatNumber(analysis.weightedRoe * 100, 1)}%` : "—"}
              </p>
            </div>
            <div className="rounded-lg border border-(--card-border) bg-(--background) p-2.5">
              <p className="text-xs text-(--muted)">Weighted Dividend Yield</p>
              <p className="text-xl font-semibold">{analysis.weightedDividendYield != null ? `${formatNumber(analysis.weightedDividendYield, 2)}%` : "—"}</p>
            </div>
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
              <p className="text-xs text-(--muted)">Strengths</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-sm">
                {analysis.strengths.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3">
              <p className="text-xs text-(--muted)">Weaknesses</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-sm">
                {analysis.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium">Investing feed for this account</h2>
        <p className="text-(--muted) text-sm">
          All account-specific position changes (your own and others if visible in feed).
        </p>
        {globalFeed.length === 0 ? (
          <p className="text-(--muted) mt-2">No investing feed entries for this account yet.</p>
        ) : (
          <ul className="mt-2 max-h-[340px] space-y-2 overflow-y-auto pr-1">
            {globalFeed.map((e) => (
              <li key={e.id} className="rounded-lg border border-(--card-border) bg-(--card) px-3 py-2 text-sm text-foreground/90">
                {formatPctChangeLine({
                  userLabel: e.user.name || e.user.email.split("@")[0],
                  symbol: e.symbol,
                  title: e.title,
                  kind: e.kind,
                  pct: e.pct,
                  oldShares: e.oldShares,
                  newShares: e.newShares,
                  at: e.createdAt,
                  accountName: e.accountName,
                })}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium">Your personal account feed</h2>
        <p className="text-(--muted) text-sm">Only this account&rsquo;s line changes, using position-relative % (same idea as the site feed, but not shown in arenas).</p>
        {feed.length === 0 ? (
          <p className="text-(--muted) mt-2">No position changes here yet.</p>
        ) : (
          <ul className="mt-2 max-h-[340px] space-y-2 overflow-y-auto pr-1">
            {feed.map((e) => (
              <li key={e.id} className="rounded-lg border border-(--card-border) bg-(--card) px-3 py-2 text-sm text-foreground/90">
                {formatPctChangeLine({
                  userLabel: "You",
                  symbol: e.symbol,
                  title: e.title,
                  kind: e.kind,
                  pct: e.pct,
                  oldShares: e.oldShares,
                  newShares: e.newShares,
                  at: e.createdAt,
                })}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
