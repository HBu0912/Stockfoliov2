"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/overview", label: "Overview" },
  { href: "/feed", label: "Investing feed" },
  { href: "/arena", label: "Arenas" },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-(--card-border) bg-(--background)/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/overview" className="text-lg font-semibold tracking-tight text-(--accent)">
          Portfolio
        </Link>
        <nav className="flex flex-wrap items-center gap-1 text-sm">
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
