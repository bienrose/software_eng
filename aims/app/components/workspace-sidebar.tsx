import Image from "next/image";
import Link from "next/link";
import { Boxes, ClipboardList, FileBarChart, Home, LogOut, Sparkles, TrendingUp } from "lucide-react";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/reports", label: "Inventory Reports", icon: FileBarChart },
  { href: "/replenishment", label: "Replenishment", icon: ClipboardList },
  { href: "/inventory_creator", label: "Inventory Creator", icon: Sparkles },
  { href: "/prediction", label: "Demand Prediction", icon: TrendingUp },
];

export function WorkspaceSidebar({ activePath }: { activePath: string }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Image src="/aims-logo.png" alt="AIMS logo" width={48} height={48} className="object-contain" />
        <p className="sidebar-brand-name">AIMS</p>
      </div>
      <nav className="sidebar-nav" aria-label="Main navigation">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active = item.href === activePath;
          return (
            <Link key={item.href} href={item.href} className={`sidebar-link${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined}>
              <Icon size={16} strokeWidth={1.75} />{item.label}
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">JD</div>
          <div className="min-w-0"><p className="sidebar-user-name">John Doe</p><p className="sidebar-user-role">Administrator</p></div>
        </div>
        <button className="sidebar-logout" type="button"><LogOut size={14} strokeWidth={1.75} />Log out</button>
      </div>
    </aside>
  );
}
