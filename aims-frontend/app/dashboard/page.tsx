"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Poppins } from "next/font/google";
import logo from "./logo.png";
import "../styles/dashboard.css";
import {
  Home,
  Boxes,
  Sparkles,
  TrendingUp,
  Bell,
  LogOut,
  Plus,
  ArrowUpRight,
} from "lucide-react";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/inventory-creator", label: "Inventory Creator", icon: Sparkles },
  { href: "/prediction", label: "Prediction", icon: TrendingUp },
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
    href: "/inventory-creator",
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
  { label: "Total items", value: 248, accent: "text-[#145c32]" },
  { label: "Low stock", value: 15, accent: "text-[#b8860b]" },
  { label: "Out of stock", value: 4, accent: "text-[#a8322c]" },
  { label: "Categories", value: 18, accent: "text-[#1e4f8a]" },
];

const user = { name: "John Doe", role: "Administrator", initials: "JD" };

export default function DashboardPage() {
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    setToday(
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    );
  }, []);

  return (
    <main className={`${poppins.className} app-shell`}>
      <div className="app-body">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <Image
              src={logo}
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
              <p className="topbar-subtitle">{today ?? "—"}</p>
            </div>
            <button className="topbar-icon-btn" title="Notifications">
              <Bell size={16} strokeWidth={1.75} />
            </button>
          </header>

          <div className="page-content">
            <div className="page-inner">
              <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {summaryStats.map((stat) => (
                  <div key={stat.label} className="card p-4">
                    <p className="text-[11px] font-medium text-[#718675]">
                      {stat.label}
                    </p>
                    <p
                      className={`mt-1.5 text-[24px] font-bold leading-none ${stat.accent}`}
                    >
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mb-8">
                <h2 className="section-title">Quick actions</h2>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                  {quickActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <Link
                        key={action.href}
                        href={action.href}
                        className="card group p-4 transition-colors hover:border-[#145c32] hover:bg-[#f0f7f1]"
                      >
                        <div className="mb-3 flex h-9 w-9 items-center justify-center bg-[#e8f5e9] text-[#145c32]">
                          <Icon size={16} strokeWidth={1.75} />
                        </div>
                        <p className="text-[12px] font-semibold">{action.title}</p>
                        <p className="mt-1 text-[11px] text-[#718675]">
                          {action.description}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="section-title mb-0">Recent inventory</h2>
                  <Link
                    href="/inventory"
                    className="text-[11px] font-medium text-[#718675] hover:text-[#145c32]"
                  >
                    View all
                  </Link>
                </div>

                <div className="card card-flush">
                  <div className="overflow-x-auto">
                    <table className="table min-w-[720px]">
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