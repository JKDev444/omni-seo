import { auth, signOut } from "@/auth";
import { Sidebar } from "@/components/Sidebar";
import { MobileNavShell } from "@/components/MobileNavShell";
import { ChatWidget } from "@/components/ChatWidget";
import { getActiveSite, getAllSites } from "@/lib/data/activeSite";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [session, activeSite, sites] = await Promise.all([auth(), getActiveSite(), getAllSites()]);

  const sidebarProps = {
    userEmail: session?.user?.email ?? null,
    signOutAction: async () => {
      "use server";
      await signOut({ redirectTo: "/login" });
    },
    activeSite: activeSite ? { id: activeSite.id, domain: activeSite.domain, platform: activeSite.platform } : null,
    sites: sites.map((s) => ({ id: s.id, domain: s.domain })),
  };

  return (
    <div className="app-shell">
      <Sidebar {...sidebarProps} />
      <MobileNavShell>
        <Sidebar {...sidebarProps} />
      </MobileNavShell>
      <main className="main">{children}</main>
      <ChatWidget />
    </div>
  );
}
