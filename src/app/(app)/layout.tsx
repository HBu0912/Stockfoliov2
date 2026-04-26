import { Nav } from "@/components/Nav";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s) redirect("/login");
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[radial-gradient(circle_at_top_left,rgba(15,118,110,0.08),transparent_35%)]">
      <Nav />
      <div className="mx-auto w-full max-w-7xl flex-1 px-5 py-6">{children}</div>
    </div>
  );
}
