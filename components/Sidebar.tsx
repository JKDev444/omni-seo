import { SiteSwitcher } from "@/components/SiteSwitcher";
import { NavLinks, type NavGroup } from "@/components/NavLinks";

// Grouped for scannability -- the flat 18-link list this replaced made
// "where do I find X" a real friction point. The four items that used
// to live here as separate entries (Findings/Scorecard/Citations/
// Maintenance) are sections of Overview, not distinct destinations --
// dropped from global nav, reachable as quick-jump anchors on that page
// instead of permanently costing 4 of the sidebar's slots.
const NAV_GROUPS: NavGroup[] = [
  { label: "Workspace", items: [
    { href: "/action-plan", label: "Action Plan" },
    { href: "/dashboard", label: "Overview" },
  ]},
  { label: "Insights", items: [
    { href: "/analytics", label: "Analytics" },
    { href: "/indexation", label: "Indexation" },
    { href: "/performance", label: "Performance" },
    { href: "/internal-links", label: "Internal Links" },
  ]},
  { label: "Content", items: [
    { href: "/content", label: "Content Quality" },
    { href: "/ai-search", label: "AI Search Readiness" },
    { href: "/content-stacks", label: "Content Stacks" },
    { href: "/keywords", label: "Keywords" },
  ]},
  { label: "Growth", items: [
    { href: "/backlinks", label: "Backlinks" },
  ]},
  { label: "Reports", items: [
    { href: "/reports", label: "Reports" },
    { href: "/change-log", label: "Change Log" },
  ]},
  { label: "System", items: [
    { href: "/project-tracker", label: "Project Tracker" },
  ]},
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

      <div className="sidebar-site">
        {activeSite ? (
          sites.length > 1 ? (
            <SiteSwitcher sites={sites} activeSiteId={activeSite.id} />
          ) : (
            <div className="sidebar-site-pill">{activeSite.domain}</div>
          )
        ) : (
          <div className="sidebar-site-pill">No site configured</div>
        )}
      </div>

      <NavLinks groups={NAV_GROUPS} />

      <div className="sidebar-foot">
        {userEmail && (
          <form action={signOutAction} className="sidebar-account">
            <span className="sidebar-account-email">{userEmail}</span>
            <button type="submit" className="sidebar-signout-btn">
              Sign out
            </button>
          </form>
        )}
      </div>
    </aside>
  );
}
