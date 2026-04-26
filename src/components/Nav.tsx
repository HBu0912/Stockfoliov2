"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/overview", label: "Overview" },
  { href: "/feed", label: "Investing feed" },
  { href: "/arena", label: "Arenas" },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [refreshingPrices, setRefreshingPrices] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  async function refreshAllPrices() {
    setRefreshingPrices(true);
    try {
      const res = await fetch("/api/holdings/refresh", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        updatedCount?: number;
        skippedCount?: number;
        error?: string;
      };
      if (!res.ok) {
        alert(data.error ?? "Could not refresh prices right now.");
        return;
      }
      window.dispatchEvent(new Event("prices-refreshed"));
      alert(
        `Price refresh complete. Updated ${data.updatedCount ?? 0} holdings, skipped ${
          data.skippedCount ?? 0
        }.`
      );
    } finally {
      setRefreshingPrices(false);
    }
  }

  return (
    <header className="sticky top-0 z-20 border-b border-(--card-border) bg-(--background)/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/overview" className="text-lg font-semibold tracking-tight text-(--accent)">
          Portfolio
        </Link>
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          <button
            type="button"
            onClick={() => void refreshAllPrices()}
            disabled={refreshingPrices}
            className="rounded-md border border-(--card-border) px-3 py-1.5 text-(--muted) hover:bg-(--card) hover:text-foreground disabled:opacity-60"
          >
            {refreshingPrices ? "Refreshing..." : "Refresh prices"}
          </button>
          {links.map((l) => {
            const on = pathname === l.href || pathname.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={
                  "rounded-md px-3 py-1.5 transition-colors " +
                  (on
                    ? "bg-(--card) font-medium text-foreground shadow-sm"
                    : "text-(--muted) hover:bg-(--card) hover:text-foreground")
                }
              >
                {l.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => void logout()}
            className="ml-2 rounded-md px-3 py-1.5 text-(--muted) hover:text-foreground"
          >
            Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}
