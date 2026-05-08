import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

type AtlasHolding = {
  symbol: string;
  name: string | null;
  shares: number;
  lastPrice: number | null;
  value: number;
  weightPct: number;
  marketCapText: string | null;
};

type AtlasMsg = { role: "user" | "assistant"; text: string };

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Atlas is not configured yet (missing ANTHROPIC_API_KEY)." }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    accountLabel?: string;
    userName?: string;
    question?: string;
    holdings?: AtlasHolding[];
    history?: AtlasMsg[];
  };

  const question = (body.question ?? "").trim();
  const accountLabel = (body.accountLabel ?? "Portfolio").trim();
  const userName = (body.userName ?? "there").trim();
  const holdings = Array.isArray(body.holdings) ? body.holdings.slice(0, 30) : [];
  const history = Array.isArray(body.history) ? body.history.slice(-8) : [];

  if (!question) return NextResponse.json({ error: "Question is required." }, { status: 400 });

  const total = holdings.reduce((s0, h) => s0 + (Number.isFinite(h.value) ? h.value : 0), 0);
  const top = [...holdings].sort((a, b) => b.weightPct - a.weightPct).slice(0, 10);
  const topSummary = top
    .map((h) => `${h.symbol}: ${h.weightPct.toFixed(1)}% (${h.value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })})`)
    .join("; ");

  const system = [
    "You are Atlas, a friendly modern portfolio assistant in a personal finance app.",
    "Sound natural and conversational, not robotic.",
    "Be concrete, analytical, and specific to the user's portfolio context.",
    "When relevant, reference concentration, diversification, sizing, and practical next actions.",
    "Never claim to execute trades. No legal/tax certainty claims.",
    "Keep response concise: around 4-8 sentences unless user asks for deep detail.",
  ].join(" ");

  const portfolioContext = [
    `User: ${userName}`,
    `Scope: ${accountLabel}`,
    `Total value: ${total.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}`,
    `Top holdings: ${topSummary || "No holdings found."}`,
    `Full holdings JSON: ${JSON.stringify(holdings)}`,
  ].join("\n");

  const messages = [
    ...history.map((m) => ({ role: m.role, content: [{ type: "text", text: m.text }] })),
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Portfolio context:\n${portfolioContext}\n\nQuestion: ${question}`,
        },
      ],
    },
  ];

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-latest",
      max_tokens: 650,
      system,
      messages,
    }),
  });

  const data = (await resp.json().catch(() => ({}))) as {
    content?: Array<{ type?: string; text?: string }>;
    error?: { message?: string };
  };

  if (!resp.ok) {
    return NextResponse.json({ error: data.error?.message ?? "Atlas request failed." }, { status: 502 });
  }

  const answer =
    data.content?.find((c) => c.type === "text" && typeof c.text === "string")?.text?.trim() ??
    "I hit a temporary issue generating a response. Please try again.";

  return NextResponse.json({ answer });
}

