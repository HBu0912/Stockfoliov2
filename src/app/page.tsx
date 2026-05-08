import Link from "next/link";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { LandingPreviewTabs } from "@/components/LandingPreviewTabs";

export default async function Home() {
  const s = await getSession();
  if (s) redirect("/overview");
  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col justify-center px-4 py-14">
      <div className="mb-5 flex justify-center">
        <BrandMark size="lg" />
      </div>
      <h1 className="bg-linear-to-r from-cyan-200 via-sky-200 to-violet-200 bg-clip-text text-center text-3xl font-semibold tracking-tight text-transparent">Your All-In-One Investing Hub</h1>
      <p className="mx-auto mt-3 max-w-3xl text-center text-slate-300">
        Add all your accounts to see the big picture of your future. Join an arena and compare portfolios with friends.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/register"
          className="rounded-md border border-cyan-400/45 bg-cyan-500/80 px-5 py-2.5 text-sm font-medium text-slate-950 shadow-lg shadow-cyan-700/25 hover:bg-cyan-400"
        >
          Create account
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-violet-400/45 bg-violet-500/15 px-5 py-2.5 text-sm font-medium text-violet-100 hover:bg-violet-500/25"
        >
          Sign in
        </Link>
      </div>

      <div id="preview" className="mt-10 scroll-mt-6">
        <h2 className="text-center text-2xl font-semibold tracking-tight">Preview the experience.</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-sm text-slate-400">
          Click any page below to explore what&apos;s waiting for you inside.
        </p>
      </div>
      <LandingPreviewTabs />

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        <section className="rounded-2xl border border-emerald-400/40 bg-gradient-to-br from-emerald-500/15 to-slate-900/70 p-5 shadow-lg shadow-emerald-900/25">
          <div className="mb-3 inline-flex rounded-lg bg-emerald-500/20 p-2">
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-emerald-300" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 7h16M4 12h16M4 17h10" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold">Unified Dashboard</h2>
          <p className="mt-1 text-sm text-slate-200">
            See every account in one place with consolidated allocation, account-level details, and quick actions.
          </p>
        </section>

        <section className="rounded-2xl border border-sky-400/40 bg-gradient-to-br from-sky-500/15 to-slate-900/70 p-5 shadow-lg shadow-sky-900/25">
          <div className="mb-3 inline-flex rounded-lg bg-sky-500/20 p-2">
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-sky-300" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 18V6m8 12V10m8 8V3" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold">Actionable Insights</h2>
          <p className="mt-1 text-sm text-slate-200">
            Follow your investing feed, monitor allocation shifts, and refresh prices whenever you want.
          </p>
        </section>

        <section className="rounded-2xl border border-violet-400/40 bg-gradient-to-br from-violet-500/15 to-slate-900/70 p-5 shadow-lg shadow-violet-900/25">
          <div className="mb-3 inline-flex rounded-lg bg-violet-500/20 p-2">
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-violet-300" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="8" cy="8" r="3" />
              <circle cx="16" cy="10" r="3" />
              <path d="M3 20c.6-2.7 2.7-4 5-4s4.4 1.3 5 4M11 20c.5-2 2-3 4-3 2.1 0 3.6 1 4 3" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold">Arena Comparison</h2>
          <p className="mt-1 text-sm text-slate-200">
            Join friends in arenas, compare portfolio mixes, and discover shared opportunities.
          </p>
        </section>
      </div>
    </div>
  );
}
