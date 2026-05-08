"use client";

import { useMemo, useState } from "react";
import type { Holding } from "@prisma/client";
import { formatNumber, formatUsd } from "@/lib/money";

type ChatMessage = { role: "atlas" | "user"; text: string };

function summarizePortfolio(holdings: Holding[]) {
  const rows = holdings
    .map((h) => ({
      symbol: h.symbol.toUpperCase(),
      value: (h.lastPrice ?? 0) * h.shares,
    }))
    .filter((h) => h.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = rows.reduce((s, r) => s + r.value, 0);
  const top = rows.slice(0, 5).map((r) => ({
    ...r,
    weight: total > 0 ? (r.value / total) * 100 : 0,
  }));
  const top3 = top.slice(0, 3).reduce((s, r) => s + r.weight, 0);
  return { total, top, top3, count: rows.length };
}

function buildAtlasReply(question: string, holdings: Holding[], accountLabel: string): string {
  const q = question.toLowerCase();
  const summary = summarizePortfolio(holdings);
  if (!summary.count) {
    return `I do not see active holdings in ${accountLabel} yet. Add a few positions and I can break down concentration, diversification, and risk right away.`;
  }

  const topText = summary.top
    .slice(0, 3)
    .map((x) => `${x.symbol} (${formatNumber(x.weight, 1)}%)`)
    .join(", ");
  const concentrationBand =
    summary.top3 >= 60 ? "concentrated" : summary.top3 >= 40 ? "balanced" : "diversified";

  if (q.includes("risk") || q.includes("volatile") || q.includes("safe")) {
    return `Risk read: ${accountLabel} looks ${concentrationBand}. Top-3 concentration is ${formatNumber(summary.top3, 1)}% (${topText}). If you want to reduce drawdown risk, consider trimming the largest single name and spreading exposure across 2-3 uncorrelated sectors.`;
  }

  if (q.includes("divers") || q.includes("allocation") || q.includes("weight")) {
    return `Allocation snapshot for ${accountLabel}: total value is about ${formatUsd(summary.total)} across ${summary.count} positions. Largest weights are ${topText}. Current top-3 concentration is ${formatNumber(summary.top3, 1)}%, which I would classify as ${concentrationBand}.`;
  }

  if (q.includes("improve") || q.includes("better") || q.includes("rebalance")) {
    const biggest = summary.top[0];
    return `A practical rebalance idea: cap your largest position (${biggest?.symbol ?? "top holding"}) near 20-25% and reallocate the excess into 2 complementary holdings. That usually improves diversification without fully changing your core thesis.`;
  }

  return `Here is my take on ${accountLabel}: you are running ${summary.count} positions with top weights ${topText}. Top-3 concentration is ${formatNumber(summary.top3, 1)}%. Ask me about risk, rebalancing, or position sizing and I will give you a more specific plan.`;
}

export function AtlasChat({
  accountLabel,
  holdings,
  userName,
  buttonClassName,
}: {
  accountLabel: string;
  holdings: Holding[];
  userName: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const greeting = useMemo(
    () => `Hi ${userName}, ask me anything about your portfolio!`,
    [userName]
  );

  function sendMessage() {
    const text = input.trim();
    if (!text) return;
    const reply = buildAtlasReply(text, holdings, accountLabel);
    setMessages((prev) => [...prev, { role: "user", text }, { role: "atlas", text: reply }]);
    setInput("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          buttonClassName ??
          "rounded-md border border-(--card-border) px-2 py-1 text-xs text-(--muted) hover:bg-(--background)"
        }
      >
        Chat with Atlas
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-(--card-border) bg-(--card) p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm text-(--muted)">Atlas Assistant</p>
                <h3 className="text-base font-semibold">{accountLabel}</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-(--card-border) px-2 py-1 text-xs hover:bg-(--background)"
              >
                Close
              </button>
            </div>

            <div className="h-[320px] overflow-y-auto rounded-xl border border-(--card-border) bg-(--background) p-3">
              <div className="mb-3 rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-2.5 text-sm">
                {greeting}
              </div>
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={
                    "mb-2 max-w-[90%] rounded-lg px-3 py-2 text-sm " +
                    (m.role === "atlas"
                      ? "mr-auto border border-(--card-border) bg-(--card)"
                      : "ml-auto bg-(--accent) text-(--accent-foreground)")
                  }
                >
                  {m.text}
                </div>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Ask Atlas about allocation, risk, or rebalancing..."
                className="flex-1 rounded-md border border-(--card-border) bg-(--background) px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={sendMessage}
                className="rounded-md bg-(--accent) px-3 py-2 text-sm font-medium text-(--accent-foreground)"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
