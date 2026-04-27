import Link from "next/link";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";

export default async function Home() {
  const s = await getSession();
  if (s) redirect("/overview");
  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col justify-center px-4 py-14">
      <div className="mb-5 flex justify-center">
        <BrandMark size="lg" />
      </div>
      <h1 className="text-center text-3xl font-semibold tracking-tight">Your All-In-One Investing Hub</h1>
      <p className="mx-auto mt-3 max-w-3xl text-center text-(--muted)">
        Add all your accounts to see the big picture of your future. Join an arena and compare portfolios with friends.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/register"
          className="rounded-md bg-(--accent) px-5 py-2.5 text-sm font-medium text-(--accent-foreground)"
        >
          Create account
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-(--card-border) px-5 py-2.5 text-sm font-medium"
        >
          Sign in
        </Link>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <section className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5 shadow-sm">
          <div className="mb-3 inline-flex rounded-lg bg-emerald-500/20 p-2">
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-emerald-300" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 7h16M4 12h16M4 17h10" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold">Unified Dashboard</h2>
          <p className="mt-1 text-sm text-(--muted)">
            See every account in one place with consolidated allocation, account-level details, and quick actions.
          </p>
        </section>

        <section className="rounded-2xl border border-sky-500/25 bg-sky-500/10 p-5 shadow-sm">
          <div className="mb-3 inline-flex rounded-lg bg-sky-500/20 p-2">
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-sky-300" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 18V6m8 12V10m8 8V3" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold">Actionable Insights</h2>
          <p className="mt-1 text-sm text-(--muted)">
            Follow your investing feed, monitor allocation shifts, and refresh prices whenever you want.
          </p>
        </section>

        <section className="rounded-2xl border border-violet-500/25 bg-violet-500/10 p-5 shadow-sm">
          <div className="mb-3 inline-flex rounded-lg bg-violet-500/20 p-2">
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-violet-300" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="8" cy="8" r="3" />
              <circle cx="16" cy="10" r="3" />
              <path d="M3 20c.6-2.7 2.7-4 5-4s4.4 1.3 5 4M11 20c.5-2 2-3 4-3 2.1 0 3.6 1 4 3" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold">Arena Comparison</h2>
          <p className="mt-1 text-sm text-(--muted)">
            Join friends in arenas, compare portfolio mixes, and discover shared opportunities.
          </p>
        </section>
      </div>

      <div className="mt-10">
        <h2 className="text-center text-2xl font-semibold tracking-tight">Preview the experience</h2>
        <p className="mx-auto mt-2 max-w-3xl text-center text-sm text-(--muted)">
          Example demo data only. Names and allocations below are placeholders.
        </p>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <section className="rounded-2xl border border-(--card-border) bg-(--card) p-4 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-(--muted)">Overview</h3>
          <div className="mt-3 rounded-xl border border-(--card-border) bg-(--background) p-3">
            <div className="flex items-center justify-between text-xs text-(--muted)">
              <span>Consolidated Portfolio</span>
              <span>$98,420</span>
            </div>
            <div className="mt-3 h-28 rounded-full border-[14px] border-sky-400/80 border-r-emerald-400/80 border-b-violet-400/80 border-l-amber-400/80" />
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-(--card-border) px-2 py-1">TECHX 24%</div>
              <div className="rounded-lg border border-(--card-border) px-2 py-1">CORE 19%</div>
              <div className="rounded-lg border border-(--card-border) px-2 py-1">GREEN 15%</div>
              <div className="rounded-lg border border-(--card-border) px-2 py-1">Other 42%</div>
            </div>
          </div>
          <p className="mt-3 text-xs text-(--muted)">
            Track every account in one place with portfolio mix + live value updates.
          </p>
        </section>

        <section className="rounded-2xl border border-(--card-border) bg-(--card) p-4 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-(--muted)">Arenas</h3>
          <div className="mt-3 rounded-xl border border-(--card-border) bg-(--background) p-3">
            <p className="text-xs font-medium">Compare with Taylor</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-(--card-border) p-2">
                <p className="text-[11px] text-(--muted)">Your mix</p>
                <div className="mt-2 h-16 rounded-full border-[10px] border-cyan-400/80 border-r-indigo-400/80 border-b-emerald-400/80 border-l-pink-400/80" />
              </div>
              <div className="rounded-lg border border-(--card-border) p-2">
                <p className="text-[11px] text-(--muted)">Taylor mix</p>
                <div className="mt-2 h-16 rounded-full border-[10px] border-orange-400/80 border-r-sky-400/80 border-b-lime-400/80 border-l-violet-400/80" />
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-(--card-border) px-2 py-1.5 text-xs">
              Top overlap: TECHX, SAFE, MKT
            </div>
          </div>
          <p className="mt-3 text-xs text-(--muted)">
            Side-by-side arena view helps compare two portfolios instantly.
          </p>
        </section>

        <section className="rounded-2xl border border-(--card-border) bg-(--card) p-4 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-(--muted)">
            Stock Comparison
          </h3>
          <div className="mt-3 space-y-2 rounded-xl border border-(--card-border) bg-(--background) p-3">
            <div className="rounded-full border border-(--card-border) px-3 py-1.5 text-xs font-medium">
              Metric Bubble: Forward P/E
            </div>
            <div className="rounded-xl border border-(--card-border) px-3 py-2 text-xs">
              TECHX: 20.4
            </div>
            <div className="rounded-xl border border-(--card-border) px-3 py-2 text-xs">
              CORE: 23.1
            </div>
            <div className="rounded-xl border border-(--card-border) px-3 py-2 text-xs">
              SAFE: 18.7
            </div>
          </div>
          <p className="mt-3 text-xs text-(--muted)">
            Add 2-3 tickers and compare each metric in clean bubble cards.
          </p>
        </section>
      </div>
    </div>
  );
}
