"use client";

import Image from "next/image";
import { useState } from "react";

type SubView = { subId: string; subLabel: string; imageSrc: string };

type PreviewPage = {
  id: string;
  title: string;
  description: string;
  imageSrc: string;
  subViews?: SubView[];
};

const PREVIEW_PAGES: PreviewPage[] = [
  {
    id: "overview",
    title: "Overview",
    description:
      "Your entire investment picture in a single snapshot. See consolidated portfolio value across every account, drill into allocation breakdowns, and surface real-time insights — all without switching apps.",
    imageSrc: "/preview/overview.png",
  },
  {
    id: "charts",
    title: "Charts & Trends",
    description:
      "Deep-dive into any ticker with interactive price charts, key metrics, and AI-generated Bulls vs Bears analysis. Switch to Trends for a quarterly view of revenue, margins, cash flow, and returns — every fundamental that matters, at a glance.",
    imageSrc: "/preview/charts.png",
    subViews: [
      { subId: "charts-price", subLabel: "Charts", imageSrc: "/preview/charts.png" },
      { subId: "charts-trends", subLabel: "Trends", imageSrc: "/preview/chart-trends.png" },
    ],
  },
  {
    id: "comparison",
    title: "Stock Comparison",
    description:
      "Stack multiple tickers side by side and see exactly who's winning. Overlay normalized performance lines to spot relative momentum, then flip to Comparison Metrics for a head-to-head breakdown of valuation, profitability, and risk.",
    imageSrc: "/preview/performance-comparison.png",
    subViews: [
      { subId: "comparison-perf", subLabel: "Performance", imageSrc: "/preview/performance-comparison.png" },
      { subId: "comparison-metrics", subLabel: "Metrics", imageSrc: "/preview/metric-comparison.png" },
    ],
  },
  {
    id: "arenas",
    title: "Arenas",
    description:
      "Invite friends into a private arena and compare portfolios head-to-head. See their allocation mix, discover shared tickers, and talk strategy in the built-in group chat — because investing is more fun with competition.",
    imageSrc: "/preview/arenas.png",
    subViews: [
      { subId: "arenas-overview", subLabel: "Arena", imageSrc: "/preview/arenas.png" },
      { subId: "arenas-chat", subLabel: "Chat", imageSrc: "/preview/arena-chat.png" },
    ],
  },
  {
    id: "indexes",
    title: "Indexes",
    description:
      "Keep a pulse on the macro environment. Track the S&P 500, NASDAQ, Dow, and Russell 2000 with live charts, then check sentiment signals like the VIX, Fear & Greed Index, and AAII Bull-Bear spread to read the room before you trade.",
    imageSrc: "/preview/index-performance.png",
  },
  {
    id: "earnings",
    title: "Earnings Calendar",
    description:
      "Never miss a catalyst. Browse every company reporting on any given day, sorted by market cap — with timing, EPS estimates, and beat/miss context so you can position ahead of the news.",
    imageSrc: "/preview/earnings-calendar.png",
  },
];

export function LandingPreviewTabs() {
  const [activeId, setActiveId] = useState(PREVIEW_PAGES[0].id);
  const [activeSubId, setActiveSubId] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const activePage = PREVIEW_PAGES.find((p) => p.id === activeId) ?? PREVIEW_PAGES[0];

  const currentSubId =
    activePage.subViews
      ? activeSubId ?? activePage.subViews[0].subId
      : null;

  const currentImageSrc =
    currentSubId && activePage.subViews
      ? (activePage.subViews.find((s) => s.subId === currentSubId)?.imageSrc ?? activePage.imageSrc)
      : activePage.imageSrc;

  const currentSubLabel =
    currentSubId && activePage.subViews
      ? (activePage.subViews.find((s) => s.subId === currentSubId)?.subLabel ?? activePage.title)
      : activePage.title;

  function selectPage(id: string) {
    setActiveId(id);
    setActiveSubId(null);
  }

  return (
    <div className="mt-5 min-w-0 rounded-2xl border border-(--card-border) bg-(--card) p-3 shadow-sm md:p-4">
      {/* Mobile dropdown — hidden on lg+ */}
      <div className="mb-3 lg:hidden">
        <select
          value={activeId}
          onChange={(e) => selectPage(e.target.value)}
          className="w-full rounded-lg border border-(--card-border) bg-(--background) px-3 py-2 text-sm text-foreground"
        >
          {PREVIEW_PAGES.map((page) => (
            <option key={page.id} value={page.id}>
              {page.title}
            </option>
          ))}
        </select>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Sidebar nav — hidden on mobile, visible lg+ */}
        <aside className="hidden min-w-0 rounded-xl border border-(--card-border) bg-(--background) p-2 lg:block">
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-(--muted)">Pages</p>
          <div className="flex flex-col gap-1">
            {PREVIEW_PAGES.map((page) => {
              const isActive = page.id === activeId;
              return (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => selectPage(page.id)}
                  className={
                    "w-full rounded-lg border px-3 py-2 text-left transition " +
                    (isActive
                      ? "border-(--accent) bg-(--card) shadow-sm"
                      : "border-(--card-border) bg-(--background) hover:bg-(--card)")
                  }
                >
                  <p className="text-sm font-medium">{page.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-(--muted)">{page.description}</p>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main panel */}
        <section className="min-w-0 rounded-xl border border-(--card-border) bg-(--background) p-2">
          {/* Header row */}
          <div className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="shrink-0 text-sm font-semibold">{activePage.title}</h3>
              {/* Sub-view toggle pills */}
              {activePage.subViews && (
                <div className="flex gap-1">
                  {activePage.subViews.map((sv) => (
                    <button
                      key={sv.subId}
                      type="button"
                      onClick={() => setActiveSubId(sv.subId)}
                      className={
                        "rounded-full border px-2.5 py-0.5 text-xs transition " +
                        (currentSubId === sv.subId
                          ? "border-(--accent) bg-(--accent)/15 text-foreground"
                          : "border-(--card-border) text-(--muted) hover:bg-(--card)")
                      }
                    >
                      {sv.subLabel}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="rounded-md border border-(--card-border) px-2 py-1 text-xs hover:bg-(--card)"
            >
              Full screen
            </button>
          </div>

          {/* Description */}
          <p className="mb-2 px-1 text-xs text-(--muted)">{activePage.description}</p>

          {/* Screenshot */}
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="block w-full overflow-hidden rounded-lg border border-(--card-border) bg-black/40"
          >
            <Image
              src={currentImageSrc}
              alt={`${activePage.title} — ${currentSubLabel} screenshot`}
              width={1600}
              height={900}
              className="h-auto max-h-[68vh] w-full object-contain"
              sizes="(max-width: 1024px) 100vw, 72vw"
              priority
              unoptimized
            />
          </button>
        </section>
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 pb-[env(safe-area-inset-bottom)] sm:items-center sm:p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <div
            className="scrollbar-hide max-h-[min(92dvh,900px)] w-full overflow-y-auto rounded-t-xl border border-(--card-border) bg-(--card) p-2 sm:max-w-[1800px] sm:rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-sm font-semibold">
                {activePage.title}{activePage.subViews ? ` — ${currentSubLabel}` : ""}
              </p>
              <button
                type="button"
                onClick={() => setLightboxOpen(false)}
                className="rounded-md border border-(--card-border) px-2 py-1 text-xs hover:bg-(--background)"
              >
                Close
              </button>
            </div>
            <div className="overflow-hidden rounded-lg border border-(--card-border) bg-black/50">
              <Image
                src={currentImageSrc}
                alt={`${activePage.title} full screenshot`}
                width={2000}
                height={1200}
                className="h-auto max-h-[84vh] w-full object-contain"
                sizes="100vw"
                unoptimized
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
