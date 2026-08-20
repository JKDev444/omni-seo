import { V1_DOMAIN } from "@/lib/data/dashboard";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/analytics", label: "Analytics" },
  { href: "/dashboard#findings", label: "Findings" },
  { href: "/dashboard#scorecard", label: "Scorecard" },
  { href: "/dashboard#citations", label: "Citations" },
  { href: "/dashboard#maintenance", label: "Maintenance" },
];

export function Sidebar({
  userEmail,
  signOutAction,
}: {
  userEmail: string | null;
  signOutAction: () => Promise<void>;
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-brand-mark">O</span>
        Omni SEO
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <a key={item.href} href={item.href} className="sidebar-link">
            {item.label}
          </a>
        ))}
      </nav>
      <div className="sidebar-site">
        <strong>{V1_DOMAIN}</strong>
        Shopify · Ella 3.0
      </div>
      {userEmail && (
        <form action={signOutAction} className="sidebar-account">
          <span className="sidebar-account-email">{userEmail}</span>
          <button type="submit" className="sidebar-signout-btn">
            Sign out
          </button>
        </form>
      )}
    </aside>
  );
}
