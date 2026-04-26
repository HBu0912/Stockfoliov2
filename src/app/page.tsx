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
      <h1 className="text-center text-3xl font-semibold tracking-tight">Build your stock story with friends</h1>
      <p className="mx-auto mt-3 max-w-3xl text-center text-(--muted)">
        Track named accounts and holdings (with live quotes), read a position-based investing feed, compare combined portfolio
        weights with friends in arenas, and keep account-only activity on each account page.
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

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-(--card-border) bg-(--card) p-4 shadow-sm">
          <h2 className="text-left text-base font-semibold">Dashboard preview</h2>
          <div className="mt-3 rounded-xl border border-(--card-border) bg-(--background) p-3">
            <div className="grid gap-3 xl:grid-cols-[180px_1fr]">
              <div className="rounded-lg border border-(--card-border) p-2">
                <p className="text-xs font-medium text-(--muted)">Accounts</p>
                <ul className="mt-2 space-y-1 text-xs">
                  <li className="rounded bg-(--card) px-2 py-1">Consolidated Overview</li>
                  <li className="rounded border border-(--card-border) px-2 py-1">Brokerage</li>
                  <li className="rounded border border-(--card-border) px-2 py-1">Roth IRA</li>
                </ul>
              </div>
              <div className="space-y-2">
                <div className="rounded-lg border border-(--card-border) p-2">
                  <p className="text-sm font-medium">Consolidated Overview</p>
                  <p className="text-xs text-(--muted)">Portfolio value: $128,450</p>
                </div>
                <div className="rounded-lg border border-(--card-border) p-2 text-xs">
                  <div className="flex justify-between"><span>AAPL</span><span>26.4%</span></div>
                  <div className="flex justify-between"><span>MSFT</span><span>19.1%</span></div>
                  <div className="flex justify-between"><span>NVDA</span><span>15.8%</span></div>
                  <div className="flex justify-between"><span>Other</span><span>38.7%</span></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-(--card-border) bg-(--card) p-4 shadow-sm">
          <h2 className="text-left text-base font-semibold">Arenas preview</h2>
          <div className="mt-3 rounded-xl border border-(--card-border) bg-(--background) p-3">
            <div className="grid gap-2 text-xs">
              <div className="rounded-lg border border-(--card-border) p-2">
                <p className="font-medium">Weekend Investors</p>
                <p className="text-(--muted)">3 members · code R82JKP1</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-(--card-border) p-2">
                  <p className="font-medium">You</p>
                  <p className="text-(--muted)">AAPL 24%, MSFT 20%, NVDA 14%</p>
                </div>
                <div className="rounded-lg border border-(--card-border) p-2">
                  <p className="font-medium">Friend</p>
                  <p className="text-(--muted)">TSLA 18%, AAPL 17%, AMZN 14%</p>
                </div>
              </div>
              <div className="rounded-lg border border-(--card-border) p-2 text-(--muted)">
                Compare portfolio mixes, overlap scores, and investing activity.
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
