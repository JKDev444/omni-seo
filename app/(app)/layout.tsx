import { auth, signOut } from "@/auth";
import { Sidebar } from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="app-shell">
      <Sidebar
        userEmail={session?.user?.email ?? null}
        signOutAction={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      />
      <main className="main">{children}</main>
    </div>
  );
}
