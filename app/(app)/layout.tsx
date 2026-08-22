import { auth, signOut } from "@/auth";
import { Sidebar } from "@/components/Sidebar";
import { getActiveSite, getAllSites } from "@/lib/data/activeSite";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [session, activeSite, sites] = await Promise.all([auth(), getActiveSite(), getAllSites()]);

  return (
    <div className="app-shell">
      <Sidebar
        userEmail={session?.user?.email ?? null}
        signOutAction={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
        activeSite={activeSite ? { id: activeSite.id, domain: activeSite.domain, platform: activeSite.platform } : null}
        sites={sites.map((s) => ({ id: s.id, domain: s.domain }))}
      />
      <main className="main">{children}</main>
    </div>
  );
}
