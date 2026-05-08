"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "./BrandMark";

const researchLinks = [
  { href: "/stock-analysis", label: "Charts" },
  { href: "/stock-comparison", label: "Stock Comparison" },
  { href: "/indexes", label: "Indexes" },
  { href: "/calendar", label: "Earnings Calendar" },
  { href: "/investor-compare", label: "Investor Compare" },
  { href: "/matchmaker", label: "Matchmaker" },
] as const;

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [researchOpen, setResearchOpen] = useState(false);
  const researchBtnRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null);

  function calcPos() {
    if (researchBtnRef.current) {
      const rect = researchBtnRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
  }

  function openResearch() {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    calcPos();
    setResearchOpen(true);
  }

  function scheduleClose() {
    closeTimer.current = setTimeout(() => setResearchOpen(false), 200);
  }

  // Document click listener — closes when clicking outside both button and dropdown
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (researchBtnRef.current?.contains(e.target as Node)) return;
      if (dropdownRef.current?.contains(e.target as Node)) return;
      setResearchOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const isOverview = pathname === "/overview" || pathname.startsWith("/overview/");
  const isArena = pathname === "/arena" || pathname.startsWith("/arena/");
  const isProfile = pathname === "/profile" || pathname.startsWith("/profile/");
  const isChats = pathname === "/chats" || pathname.startsWith("/chats/");
  const researchActive = researchLinks.some((l) => pathname === l.href || pathname.startsWith(l.href + "/"));

  return (
    <header className="sticky top-0 z-20 border-b border-(--card-border) bg-(--background)/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex min-w-0 max-w-7xl items-center gap-2 px-[max(0.75rem,env(safe-area-inset-left))] py-2 pr-[max(0.75rem,env(safe-area-inset-right))] sm:gap-4 sm:px-5 sm:py-3">
        <Link href="/overview" className="shrink-0">
          <div className="scale-90 sm:scale-100">
            <BrandMark />
          </div>
        </Link>
        <nav className="scrollbar-hide ml-auto flex min-w-0 touch-pan-x items-center justify-end gap-1 overflow-x-auto overflow-y-visible py-0.5 text-xs [-webkit-overflow-scrolling:touch] sm:overflow-visible sm:gap-2 sm:text-sm sm:py-0">
          <Link
            href="/overview"
            className={
              "shrink-0 whitespace-nowrap rounded-md border px-2 py-1 sm:px-3 sm:py-1.5 " +
              (isOverview
                ? "border-(--accent) bg-(--card) text-foreground"
                : "border-(--card-border) text-(--muted) hover:bg-(--card) hover:text-foreground")
            }
          >
            Overview
          </Link>
          <Link
            href="/arena"
            className={
              "shrink-0 whitespace-nowrap rounded-md border px-2 py-1 sm:px-3 sm:py-1.5 " +
              (isArena
                ? "border-(--accent) bg-(--card) text-foreground"
                : "border-(--card-border) text-(--muted) hover:bg-(--card) hover:text-foreground")
            }
          >
            Arenas
          </Link>
          {/* Desktop: hover open/close · Mobile: tap to toggle */}
          <div
            className="shrink-0"
            onMouseEnter={() => { if (!('ontouchstart' in window)) openResearch(); }}
            onMouseLeave={() => { if (!('ontouchstart' in window)) scheduleClose(); }}
          >
            <button
              ref={researchBtnRef}
              type="button"
              onClick={() => researchOpen ? setResearchOpen(false) : openResearch()}
              className={
                "whitespace-nowrap rounded-md border px-2 py-1 sm:px-3 sm:py-1.5 " +
                (researchActive
                  ? "border-(--accent) bg-(--card) text-foreground"
                  : "border-(--card-border) text-(--muted) hover:bg-(--card) hover:text-foreground")
              }
            >
              Research
            </button>
          </div>
          {researchOpen && dropdownPos ? (
            <div
              ref={dropdownRef}
              className="fixed z-50"
              style={{ top: dropdownPos.top, right: dropdownPos.right }}
              onMouseEnter={() => { if (!('ontouchstart' in window)) openResearch(); }}
              onMouseLeave={() => { if (!('ontouchstart' in window)) scheduleClose(); }}
            >
              <div className="w-[min(18rem,calc(100vw-1.5rem))] max-h-[min(70vh,24rem)] overflow-y-auto overscroll-y-contain rounded-lg border border-(--card-border) bg-(--card) p-1 shadow-lg">
                {researchLinks.map((l) => {
                  const on = pathname === l.href || pathname.startsWith(l.href + "/");
                  return (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={() => setResearchOpen(false)}
                      className={
                        "block rounded-md px-3 py-2 text-sm transition-colors " +
                        (on
                          ? "bg-(--background) font-medium text-foreground"
                          : "text-(--muted) hover:bg-(--background) hover:text-foreground")
                      }
                    >
                      {l.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}
          <Link
            href="/chats"
            className={
              "shrink-0 whitespace-nowrap rounded-md border px-2 py-1 sm:px-3 sm:py-1.5 " +
              (isChats
                ? "border-(--accent) bg-(--card) text-foreground"
                : "border-(--card-border) text-(--muted) hover:bg-(--card) hover:text-foreground")
            }
            aria-label="Chats"
          >
            💬
          </Link>
          <Link
            href="/profile"
            className={
              "shrink-0 whitespace-nowrap rounded-md border px-2 py-1 sm:px-3 sm:py-1.5 " +
              (isProfile
                ? "border-(--accent) bg-(--card) text-foreground"
                : "border-(--card-border) text-(--muted) hover:bg-(--card) hover:text-foreground")
            }
          >
            Profile
          </Link>
          <button
            type="button"
            onClick={() => void logout()}
            className="shrink-0 whitespace-nowrap rounded-md px-2 py-1 sm:ml-2 sm:px-3 sm:py-1.5 text-(--muted) hover:text-foreground"
          >
            Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}
