"use client";

import { useCallback, useEffect, useState } from "react";

type Me = { id: string; email: string; name: string | null };

export default function ProfilePage() {
  const [user, setUser] = useState<Me | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    const r = await fetch("/api/auth/me");
    if (!r.ok) return void setErr("Could not load profile");
    const d = (await r.json()) as { user: Me | null };
    if (!d.user) return void setErr("No user found");
    setUser(d.user);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user && !err) return <p className="text-(--muted)">Loading profile...</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {user && (
        <div className="rounded-2xl border border-(--card-border) bg-(--card) p-5 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-(--muted)">Username</p>
              <p className="mt-1 text-lg font-medium">{user.name || user.email.split("@")[0]}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-(--muted)">Email</p>
              <p className="mt-1 text-lg font-medium">{user.email}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
