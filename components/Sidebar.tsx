import { SiteSwitcher } from "@/components/SiteSwitcher";

const NAV_ITEMS = [
  { href: "/action-plan", label: "Action Plan" },
  { href: "/dashboard", label: "Overview" },
  { href: "/analytics", label: "Analytics" },
  { href: "/indexation", label: "Indexation" },
  { href: "/performance", label: "Performance" },
  { href: "/internal-links", label: "Internal Links" },
  { href: "/content", label: "Content Quality" },
  { href: "/ai-search", label: "AI Search Readiness" },
  { href: "/keywords", label: "Keywords" },
  { href: "/content-stacks", label: "Content Stacks" },
  { href: "/backlinks", label: "Backlinks" },
  { href: "/dashboard#findings", label: "Findings" },
  { href: "/dashboard#scorecard", label: "Scorecard" },
  { href: "/dashboard#citations", label: "Citations" },
  { href: "/dashboard#maintenance", label: "Maintenance" },
  { href: "/reports", label: "Reports" },
  { href: "/change-log", label: "Change Log" },
  { href: "/project-tracker", label: "Project Tracker" },
];

export function Sidebar({
  userEmail,
  signOutAction,
  activeSite,
  sites,
}: {
  userEmail: string | null;
  signOutAction: () => Promise<void>;
  activeSite: { id: string; domain: string; platform: string } | null;
  sites: { id: string; domain: string }[];
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
        {activeSite ? (
          <>
            {sites.length > 1 ? (
              <SiteSwitcher sites={sites} activeSiteId={activeSite.id} />
            ) : (
              <strong>{activeSite.domain}</strong>
            )}
            <span>{activeSite.platform}</span>
          </>
        ) : (
          <strong>No site configured</strong>
        )}
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
