"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Poppins } from "next/font/google";
import {
  Home,
  Boxes,
  Sparkles,
  TrendingUp,
  Bell,
  LogOut,
  Plus,
  ArrowUpRight,
  ArrowRight,
  Search,
  PackageCheck,
  AlertTriangle,
  Layers3,
  Activity,
  FileBarChart,
} from "lucide-react";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/reports", label: "Inventory Reports", icon: FileBarChart },
  { href: "/inventory_creator", label: "Inventory Creator", icon: Sparkles },
  { href: "/prediction", label: "Demand Prediction", icon: TrendingUp },
];

type Stock = "in-stock" | "low-stock" | "out-of-stock";

const statusLabel: Record<Stock, string> = {
  "in-stock": "In stock",
  "low-stock": "Low stock",
  "out-of-stock": "Out of stock",
};

const inventoryRows: {
  name: string;
  category: string;
  quantity: number;
  status: Stock;
}[] = [
  { name: "First Aid Kit", category: "Medical", quantity: 42, status: "in-stock" },
  { name: "Bottled Water", category: "Relief Goods", quantity: 120, status: "in-stock" },
  { name: "Emergency Blanket", category: "Emergency", quantity: 18, status: "low-stock" },
  { name: "Flashlight", category: "Equipment", quantity: 0, status: "out-of-stock" },
];

const quickActions = [
  {
    href: "/inventory/add",
    icon: Plus,
    title: "Add inventory",
    description: "Record a new item entering the warehouse.",
  },
  {
    href: "/inventory_creator",
    icon: Sparkles,
    title: "Inventory creator",
    description: "Generate a category structure from a brief.",
  },
  {
    href: "/prediction",
    icon: TrendingUp,
    title: "Demand prediction",
    description: "Forecast restock needs from past movement.",
  },
];

const summaryStats = [
  { label: "Total items", value: "248", note: "+12 this month", icon: Boxes, tone: "blue" },
  { label: "Low stock", value: "15", note: "Needs attention", icon: AlertTriangle, tone: "amber" },
  { label: "Out of stock", value: "4", note: "Across 3 categories", icon: PackageCheck, tone: "rose" },
  { label: "Categories", value: "18", note: "Inventory groups", icon: Layers3, tone: "violet" },
];

const user = { name: "John Doe", role: "Administrator", initials: "JD" };

export default function DashboardPage() {
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setToday(
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    ), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <main className={`${poppins.className} app-shell dashboard-theme`}>
      <div className="app-body">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <Image
              src="/aims-logo.png"
              alt="AIMS logo"
              width={48}
              height={48}
              className="object-contain"
            />
            <p className="sidebar-brand-name">AIMS</p>
          </div>

          <nav className="sidebar-nav">
            {navItems.map((item) => {
              const active = item.href === "/dashboard";
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sidebar-link ${active ? "is-active" : ""}`}
                >
                  <Icon size={16} strokeWidth={1.75} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="sidebar-footer">
            <div className="sidebar-user">
              <div className="sidebar-avatar">{user.initials}</div>
              <div className="min-w-0">
                <p className="sidebar-user-name">{user.name}</p>
                <p className="sidebar-user-role">{user.role}</p>
              </div>
            </div>
            <button className="sidebar-logout">
              <LogOut size={14} strokeWidth={1.75} />
              Log out
            </button>
          </div>
        </aside>

        <section className="main">
          <header className="topbar">
            <div>
              <h1 className="topbar-title">Dashboard</h1>
              <p className="topbar-subtitle">Overview of inventory levels, stock alerts, and recent activity.</p>
            </div>
            <div className="topbar-tools">
              <span className="topbar-date">{today ?? "—"}</span>
              <button className="topbar-icon-btn" title="Notifications" aria-label="Notifications">
                <Bell size={17} strokeWidth={1.8} /><i />
              </button>
              <div className="topbar-profile">JD</div>
            </div>
          </header>

          <div className="page-content">
            <div className="page-inner dashboard-inner">
              <section className="welcome-panel">
                <div className="welcome-copy">
                  <span className="welcome-kicker"><Activity size={14} /> INVENTORY AT A GLANCE</span>
                  <h2>Good to see you, {user.name.split(" ")[0]}.</h2>
                  <p>Here’s what’s happening across your inventory today.</p>
                </div>
              </section>

              <div className="stats-grid">
                {summaryStats.map((stat) => (
                  <div key={stat.label} className={`stat-card stat-${stat.tone}`}>
                    <div className="stat-top"><span>{stat.label}</span><span className="stat-icon"><stat.icon size={18} /></span></div>
                    <p className="stat-value">{stat.value}</p>
                    <p className="stat-note">{stat.note}</p>
                  </div>
                ))}
              </div>

              <div className="dashboard-section">
                <div className="section-heading"><div><span className="section-kicker">GET THINGS DONE</span><h2 className="section-title">Quick actions</h2></div><span className="section-hint">Shortcuts to your workspace</span></div>
                <div className="actions-grid">
                  {quickActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <Link
                        key={action.href}
                        href={action.href}
                        className="action-card group"
                      >
                        <div className="action-icon">
                          <Icon size={16} strokeWidth={1.75} />
                        </div>
                        <p className="action-title">{action.title}</p>
                        <p className="action-description">
                          {action.description}
                        </p>
                        <span className="action-arrow"><ArrowUpRight size={16} /></span>
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div className="dashboard-section inventory-section">
                <div className="section-heading"><div><span className="section-kicker">LATEST UPDATES</span><h2 className="section-title mb-0">Recent inventory</h2></div>
                  <Link
                    href="/inventory"
                    className="view-all-link"
                  >
                    View all inventory <ArrowRight size={14} />
                  </Link>
                </div>

                <div className="inventory-card">
                  <div className="table-toolbar"><div className="table-heading"><span className="table-dot" /> Stock snapshot <span className="table-count">4 items</span></div><Link href="/inventory" className="table-search"><Search size={15} /> Browse inventory</Link></div>
                  <div className="overflow-x-auto">
                    <table className="table dashboard-table min-w-[720px]">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Category</th>
                          <th>Quantity</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventoryRows.map((row) => (
                          <tr key={row.name}>
                            <td className="cell-strong">{row.name}</td>
                            <td className="cell-muted">{row.category}</td>
                            <td className="cell-strong">{row.quantity}</td>
                            <td>
                              <span className={`badge badge-${row.status}`}>
                                {statusLabel[row.status]}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
