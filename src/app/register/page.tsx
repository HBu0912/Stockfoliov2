"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setPending(true);
    const r = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name: name || undefined }),
    });
    setPending(false);
    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      setErr(d.error ?? "Registration failed");
      return;
    }
    router.push("/overview");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-full max-w-sm flex-col justify-center px-4 py-16">
      <h1 className="text-2xl font-semibold">Create account</h1>
      <p className="mt-1 text-sm text-(--muted)">At least 8 characters. Your password is never stored in plain text.</p>
      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
        <div>
          <label className="text-sm font-medium">Display name (optional)</label>
          <input
            className="mt-1 w-full rounded-md border border-(--card-border) bg-(--background) px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Shown in arenas and the feed"
          />
        </div>
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
            autoComplete="new-password"
            minLength={8}
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
          {pending ? "…" : "Create and sign in"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-(--muted)">
        Already have an account?{" "}
        <Link href="/login" className="text-(--accent)">
          Sign in
        </Link>
      </p>
    </div>
  );
}
