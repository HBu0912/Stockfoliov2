import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

export default function FeaturesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="text-center">
        <div className="mb-3 inline-flex">
          <BrandMark size="lg" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">See what Stockfolio can do</h1>
        <p className="mt-2 text-(--muted)">
          A modern personal finance cockpit with portfolio tracking, smart feeds, and social comparison arenas.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <Link href="/register" className="rounded-md bg-(--accent) px-5 py-2 text-sm font-medium text-(--accent-foreground)">
            Create account
          </Link>
          <Link href="/login" className="rounded-md border border-(--card-border) px-5 py-2 text-sm font-medium">
            Sign in
          </Link>
        </div>
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-(--card-border) bg-(--card) p-4 shadow-sm">
          <h2 className="text-xl font-semibold">Dashboard</h2>
          <p className="text-sm text-(--muted)">
            Track consolidated and account-level views, refresh prices on demand, and monitor your investing feed.
          </p>
          <div className="mt-4 rounded-xl border border-(--card-border) bg-(--background) p-3">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium">Consolidated Overview</span>
              <span className="text-sm text-(--muted)">$128,450</span>
            </div>
            <div className="grid gap-2 text-xs text-(--muted)">
              <div className="flex justify-between"><span>AAPL</span><span>26.4%</span></div>
              <div className="flex justify-between"><span>MSFT</span><span>19.1%</span></div>
              <div className="flex justify-between"><span>NVDA</span><span>15.8%</span></div>
              <div className="flex justify-between"><span>GOOGL</span><span>12.2%</span></div>
              <div className="flex justify-between"><span>Other</span><span>26.5%</span></div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-(--card-border) bg-(--card) p-4 shadow-sm">
          <h2 className="text-xl font-semibold">Arena</h2>
          <p className="text-sm text-(--muted)">
            Join friends, compare top holdings, and explore overlap/diversification insights in your Stockfolio circle.
          </p>
          <div className="mt-4 rounded-xl border border-(--card-border) bg-(--background) p-3">
            <div className="mb-3 text-sm font-medium">Weekend Investors</div>
            <div className="grid gap-2 text-xs">
              <div className="rounded border border-(--card-border) p-2">You: AAPL 24%, MSFT 20%, NVDA 14%</div>
              <div className="rounded border border-(--card-border) p-2">Sam: TSLA 18%, AAPL 17%, AMZN 14%</div>
              <div className="rounded border border-(--card-border) p-2">Jordan: META 22%, AAPL 16%, NFLX 9%</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
