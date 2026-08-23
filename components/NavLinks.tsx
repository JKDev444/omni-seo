"use client";

import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export function NavLinks({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();

  return (
    <nav className="sidebar-nav">
      {groups.map((group) => (
        <div className="nav-group" key={group.label}>
          <div className="nav-group-label">{group.label}</div>
          {group.items.map((item) => (
            <a key={item.href} href={item.href} className={`sidebar-link${pathname === item.href ? " active" : ""}`}>
              {item.label}
            </a>
          ))}
        </div>
      ))}
    </nav>
  );
}
