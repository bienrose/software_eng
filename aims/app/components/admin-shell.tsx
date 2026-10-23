import Link from "next/link";
import { Boxes, ChartNoAxesCombined, ClipboardList, FileBarChart, Home, Sparkles, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/reports", label: "Reports", icon: FileBarChart },
  { href: "/replenishment", label: "Replenishment", icon: ClipboardList },
  { href: "/prediction", label: "Demand prediction", icon: TrendingUp },
  { href: "/inventory_creator", label: "Inventory creator", icon: Sparkles },
];

export function AdminShell({ activePath, title, children }: { activePath: string; title: string; children: ReactNode }) {
  return <main className="admin-shell"><div className="admin-layout"><aside className="admin-sidebar"><Link className="admin-brand" href="/dashboard"><span className="admin-brand-mark"><ChartNoAxesCombined /></span>AIMS</Link><nav className="admin-nav" aria-label="Main navigation">{navigation.map((item) => { const Icon = item.icon; return <Link key={item.href} className="admin-nav-link" data-active={item.href === activePath} href={item.href}><Icon strokeWidth={1.75} />{item.label}</Link>; })}</nav></aside><section className="admin-main"><header className="admin-topbar"><h1 className="admin-topbar-title">{title}</h1><div className="admin-user"><span>Administrator</span><span className="admin-avatar">JD</span></div></header>{children}</section></div></main>;
}
