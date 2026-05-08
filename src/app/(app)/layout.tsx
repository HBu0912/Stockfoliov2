import { Nav } from "@/components/Nav";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s) redirect("/login");
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[radial-gradient(circle_at_top_left,rgba(15,118,110,0.08),transparent_35%)]">
      <Nav />
      <div className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:px-5 sm:py-6">{children}</div>
    </div>
  );
}
