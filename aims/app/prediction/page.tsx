"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Poppins } from "next/font/google";
import { AlertTriangle, Bell, Boxes, CalendarClock, FileBarChart, Home, Lightbulb, LogOut, PackageCheck, Sparkles, TrendingUp } from "lucide-react";
import styles from "../styles/analytics.module.css";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/reports", label: "Inventory Reports", icon: FileBarChart },
  { href: "/inventory_creator", label: "Inventory Creator", icon: Sparkles },
  { href: "/prediction", label: "Demand Prediction", icon: TrendingUp },
];

type ForecastItem = {
  inventoryId: string;
  inventoryName: string;
  id: string;
  name: string;
  code: string;
  unit: string;
  quantity: number;
  reorderLevel: number;
  issuedLast30Days: number;
};
type InventoryOption = { id: string; name: string };
type AnalyticsResponse = { inventories: InventoryOption[]; items: ForecastItem[]; error?: string };
type Forecast = ForecastItem & { dailyRate: number; daysRemaining: number | null; recommended: number; status: string };
const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

export default function DemandPredictionPage() {
  const [inventories, setInventories] = useState<InventoryOption[]>([]);
  const [items, setItems] = useState<ForecastItem[]>([]);
  const [selectedInventory, setSelectedInventory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadForecast = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/analytics", { cache: "no-store" });
      const result = await response.json() as AnalyticsResponse;
      if (!response.ok) throw new Error(result.error || "Could not load demand data.");
      setInventories(result.inventories ?? []);
      setItems(result.items ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load demand data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadForecast(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadForecast]);

  const forecasts = useMemo<Forecast[]>(() => items
    .filter((item) => selectedInventory === "all" || item.inventoryId === selectedInventory)
    .map((item) => {
      const dailyRate = item.issuedLast30Days / 30;
      const daysRemaining = dailyRate > 0 ? item.quantity / dailyRate : null;
      const status = item.quantity <= 0
        ? "Out of stock"
        : item.quantity <= item.reorderLevel
          ? "Below reorder"
          : dailyRate === 0
            ? "No usage history"
            : daysRemaining !== null && daysRemaining <= 30
              ? "Reorder soon"
              : "On track";
      const recommended = dailyRate > 0
        ? Math.max(item.reorderLevel + item.issuedLast30Days - item.quantity, 0)
        : item.quantity <= item.reorderLevel
          ? Math.max(item.reorderLevel * 2 - item.quantity, 0)
          : 0;
      return { ...item, dailyRate, daysRemaining, recommended, status };
    })
    .sort((a, b) => {
      const aDays = a.daysRemaining ?? Number.POSITIVE_INFINITY;
      const bDays = b.daysRemaining ?? Number.POSITIVE_INFINITY;
      const aRisk = a.quantity <= a.reorderLevel ? 0 : aDays <= 30 ? 1 : a.dailyRate === 0 ? 3 : 2;
      const bRisk = b.quantity <= b.reorderLevel ? 0 : bDays <= 30 ? 1 : b.dailyRate === 0 ? 3 : 2;
      return aRisk - bRisk || aDays - bDays || a.name.localeCompare(b.name);
    }), [items, selectedInventory]);

  const metrics = useMemo(() => ({
    monthlyDemand: forecasts.reduce((sum, item) => sum + item.issuedLast30Days, 0),
    withHistory: forecasts.filter((item) => item.issuedLast30Days > 0).length,
    atRisk: forecasts.filter((item) => ["Out of stock", "Below reorder", "Reorder soon"].includes(item.status)).length,
    recommended: forecasts.reduce((sum, item) => sum + item.recommended, 0),
  }), [forecasts]);

  const metricCards = [
    { label: "Issued in last 30 days", value: numberFormat.format(metrics.monthlyDemand), note: "Baseline for the projection", icon: TrendingUp },
    { label: "Items with usage history", value: numberFormat.format(metrics.withHistory), note: `Of ${forecasts.length} visible items`, icon: CalendarClock },
    { label: "Items to review", value: numberFormat.format(metrics.atRisk), note: "Low stock or ≤30 days of cover", icon: AlertTriangle },
    { label: "Suggested restock", value: numberFormat.format(metrics.recommended), note: "Units to cover demand and reorder level", icon: PackageCheck },
  ];

  return (
    <main className={`${poppins.className} app-shell dashboard-theme`}>
      <div className="app-body">
        <aside className="sidebar">
          <div className="sidebar-brand"><Image src="/aims-logo.png" alt="AIMS logo" width={48} height={48} className="object-contain" /><p className="sidebar-brand-name">AIMS</p></div>
          <nav className="sidebar-nav" aria-label="Main navigation">
            {navItems.map((item) => { const Icon = item.icon; const active = item.href === "/prediction"; return <Link key={item.href} href={item.href} className={`sidebar-link${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined}><Icon size={16} strokeWidth={1.75} />{item.label}</Link>; })}
          </nav>
          <div className="sidebar-footer"><div className="sidebar-user"><div className="sidebar-avatar">JD</div><div className="min-w-0"><p className="sidebar-user-name">John Doe</p><p className="sidebar-user-role">Administrator</p></div></div><button className="sidebar-logout" type="button"><LogOut size={14} strokeWidth={1.75} />Log out</button></div>
        </aside>

        <section className="main">
          <header className="topbar"><div><h1 className="topbar-title">Demand Prediction</h1><p className="topbar-subtitle">Plan replenishment from recent stock-out activity.</p></div><div className="topbar-tools"><button className="topbar-icon-btn" type="button" title="Notifications" aria-label="Notifications"><Bell size={16} strokeWidth={1.75} /></button><div className="topbar-profile">JD</div></div></header>
          <div className="page-content">
            <div className={`${styles.content} page-inner`}>
              <div className={styles.intro}>
                <div><p className={styles.eyebrow}>DEMAND OUTLOOK</p><h2 className={styles.title}>Restock planning</h2><p className={styles.description}>Use the last 30 days of issued stock as a simple run-rate baseline for estimated coverage and replenishment.</p></div>
                <div className={styles.toolbar}>
                  <select className={styles.select} value={selectedInventory} onChange={(event) => setSelectedInventory(event.target.value)} aria-label="Filter by inventory">
                    <option value="all">All inventories</option>
                    {inventories.map((inventory) => <option value={inventory.id} key={inventory.id}>{inventory.name}</option>)}
                  </select>
                  <button className={styles.button} type="button" onClick={() => void loadForecast()} disabled={loading}><TrendingUp size={14} />Refresh</button>
                </div>
              </div>

              <div className={styles.notice}><Lightbulb size={15} /><span>Estimates assume recent stock-out activity continues. Items without recorded stock-out history are marked so you can review them without relying on a made-up forecast.</span></div>
              {error && <div className={styles.error} role="alert"><span>{error}</span><button type="button" onClick={() => void loadForecast()}>Retry</button></div>}

              <div className={styles.metrics}>
                {metricCards.map((metric) => { const Icon = metric.icon; return <article className={styles.metric} key={metric.label}><div className={styles.metricTop}><span>{metric.label}</span><span className={styles.metricIcon}><Icon size={16} /></span></div><div className={styles.metricValue}>{loading ? "—" : metric.value}</div><p className={styles.metricNote}>{metric.note}</p></article>; })}
              </div>

              <section className={styles.panel} aria-label="Demand forecast by item">
                <div className={styles.panelHeader}><h3 className={styles.panelTitle}>Item demand outlook</h3><span className={styles.panelMeta}>{loading ? "Loading forecast…" : `${forecasts.length} items`}</span></div>
                {loading ? <div className={styles.state}>Loading demand data…</div> : error ? null : forecasts.length === 0 ? <div className={styles.state}>{items.length === 0 ? "No inventory items are available for forecasting yet." : "No items in this inventory."}</div> : <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Item</th><th>On hand</th><th>Issued · 30d</th><th>Est. days cover</th><th>Suggested restock</th><th>Status</th></tr></thead><tbody>
                  {forecasts.map((item) => {
                    const coverPercent = item.daysRemaining === null ? 0 : Math.max(0, Math.min(100, item.daysRemaining / 60 * 100));
                    const coverageClass = item.quantity <= 0 ? styles.coverageFillEmpty : item.daysRemaining !== null && item.daysRemaining <= 30 ? styles.coverageFillRisk : styles.coverageFill;
                    const badgeClass = item.status === "Out of stock" ? styles.badgeDanger : item.status === "Below reorder" || item.status === "Reorder soon" ? styles.badgeWarn : item.status === "On track" ? styles.badgeGood : styles.badgeNeutral;
                    return <tr key={item.id}>
                      <td className={styles.itemCell}><strong>{item.name}</strong><span className={styles.itemSub}>{item.inventoryName}{item.code ? ` · ${item.code}` : ""}</span></td>
                      <td className={styles.number}>{numberFormat.format(item.quantity)} {item.unit}</td>
                      <td className={styles.number}>{numberFormat.format(item.issuedLast30Days)} {item.unit}</td>
                      <td>{item.daysRemaining === null ? <span className={styles.badgeNeutral}>No history</span> : <span className={styles.coverage}><span className={styles.number}>{numberFormat.format(item.daysRemaining)} days</span><span className={styles.coverageTrack}><span className={`${styles.coverageFill} ${coverageClass}`} style={{ width: `${coverPercent}%` }} /></span></span>}</td>
                      <td className={styles.number}>{item.recommended > 0 ? `${numberFormat.format(item.recommended)} ${item.unit}` : "—"}</td>
                      <td><span className={`${styles.badge} ${badgeClass}`}>{item.status}</span></td>
                    </tr>;
                  })}
                </tbody></table></div>}
              </section>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
