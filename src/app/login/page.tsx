"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setPending(true);
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setPending(false);
    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      setErr(d.error ?? "Sign in failed");
      return;
    }
    const next =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("next") || "/overview"
        : "/overview";
    router.push(next);
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-full max-w-sm flex-col justify-center px-4 py-16">
      <div className="mb-4 text-center">
        <Link href="/" className="inline-flex">
          <BrandMark size="lg" />
        </Link>
      </div>
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-1 text-sm text-(--muted)">Passwords are hashed on the server; sessions use a signed cookie.</p>
      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
        <div>
          <label className="text-sm font-medium">Email</label>
          <input
            type="email"
            autoComplete="email"
            className="mt-1 w-full rounded-md border border-(--card-border) bg-(--background) px-3 py-2 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium">Password</label>
          <input
            type="password"
            autoComplete="current-password"
            className="mt-1 w-full rounded-md border border-(--card-border) bg-(--background) px-3 py-2 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-(--accent) py-2 text-sm font-medium text-(--accent-foreground) disabled:opacity-50"
        >
          {pending ? "…" : "Sign in"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-(--muted)">
        No account?{" "}
        <Link href="/register" className="text-(--accent)">
          Create one
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-(--muted)">
        New here?{" "}
        <Link href="/#preview" className="text-(--accent)">
          Explore features
        </Link>
      </p>
    </div>
  );
}
