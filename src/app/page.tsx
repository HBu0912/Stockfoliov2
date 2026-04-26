import Link from "next/link";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";

export default async function Home() {
  const s = await getSession();
  if (s) redirect("/overview");
  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center px-4 py-20 text-center">
      <div className="mb-5 flex justify-center">
        <BrandMark size="lg" />
      </div>
      <h1 className="text-3xl font-semibold tracking-tight">Build your stock story with friends</h1>
      <p className="mt-3 text-(--muted)">
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
        <Link
          href="/features"
          className="rounded-md border border-(--card-border) px-5 py-2.5 text-sm font-medium"
        >
          View features
        </Link>
      </div>
    </div>
  );
}
