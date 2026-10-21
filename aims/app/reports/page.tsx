"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Poppins } from "next/font/google";
import { AlertTriangle, Bell, Boxes, Download, FileBarChart, Home, LogOut, PackageCheck, Sparkles, TrendingUp } from "lucide-react";
import styles from "../styles/analytics.module.css";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/reports", label: "Inventory Reports", icon: FileBarChart },
  { href: "/inventory_creator", label: "Inventory Creator", icon: Sparkles },
  { href: "/prediction", label: "Demand Prediction", icon: TrendingUp },
];

type InventoryReport = {
  id: string;
  name: string;
  description: string;
  itemCount: number;
  totalUnits: number;
  lowStockCount: number;
  outOfStockCount: number;
};
type AnalyticsResponse = { inventories: InventoryReport[]; error?: string };
const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export default function InventoryReportsPage() {
  const [inventories, setInventories] = useState<InventoryReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/analytics", { cache: "no-store" });
      const result = await response.json() as AnalyticsResponse;
      if (!response.ok) throw new Error(result.error || "Could not load inventory reports.");
      setInventories(result.inventories ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load inventory reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadReport(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadReport]);

  const totals = useMemo(() => inventories.reduce((summary, inventory) => ({
    items: summary.items + inventory.itemCount,
    units: summary.units + inventory.totalUnits,
    low: summary.low + inventory.lowStockCount,
    out: summary.out + inventory.outOfStockCount,
  }), { items: 0, units: 0, low: 0, out: 0 }), [inventories]);

  function exportCsv() {
    const headings = ["Inventory", "Items", "Total units", "Low stock", "Out of stock", "Health"];
    const rows = inventories.map((inventory) => [
      inventory.name,
      inventory.itemCount,
      inventory.totalUnits,
      inventory.lowStockCount,
      inventory.outOfStockCount,
      inventory.outOfStockCount > 0 ? "Out of stock items" : inventory.lowStockCount > 0 ? "Needs attention" : "Healthy",
    ]);
    const csv = [headings, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `aims-inventory-report-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const metrics = [
    { label: "Inventories", value: inventories.length, note: "Active inventory groups", icon: Boxes },
    { label: "Tracked items", value: totals.items, note: "Across all inventories", icon: FileBarChart },
    { label: "Total units", value: totals.units, note: "Current on-hand quantity", icon: PackageCheck },
    { label: "Needs attention", value: totals.low + totals.out, note: `${totals.low} low · ${totals.out} out of stock`, icon: AlertTriangle },
  ];

  return (
    <main className={`${poppins.className} app-shell dashboard-theme`}>
      <div className="app-body">
        <aside className="sidebar">
          <div className="sidebar-brand"><Image src="/aims-logo.png" alt="AIMS logo" width={48} height={48} className="object-contain" /><p className="sidebar-brand-name">AIMS</p></div>
          <nav className="sidebar-nav" aria-label="Main navigation">
            {navItems.map((item) => { const Icon = item.icon; const active = item.href === "/reports"; return <Link key={item.href} href={item.href} className={`sidebar-link${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined}><Icon size={16} strokeWidth={1.75} />{item.label}</Link>; })}
          </nav>
          <div className="sidebar-footer"><div className="sidebar-user"><div className="sidebar-avatar">JD</div><div className="min-w-0"><p className="sidebar-user-name">John Doe</p><p className="sidebar-user-role">Administrator</p></div></div><button className="sidebar-logout" type="button"><LogOut size={14} strokeWidth={1.75} />Log out</button></div>
        </aside>

        <section className="main">
          <header className="topbar"><div><h1 className="topbar-title">Inventory Reports</h1><p className="topbar-subtitle">A clear summary of inventory levels and stock health.</p></div><div className="topbar-tools"><button className="topbar-icon-btn" type="button" title="Notifications" aria-label="Notifications"><Bell size={16} strokeWidth={1.75} /></button><div className="topbar-profile">JD</div></div></header>
          <div className="page-content">
            <div className={`${styles.content} page-inner`}>
              <div className={styles.intro}>
                <div><p className={styles.eyebrow}>INVENTORY HEALTH</p><h2 className={styles.title}>Inventory reports</h2><p className={styles.description}>Review item counts, available units, and stock that may need attention.</p></div>
                <div className={styles.toolbar}><button className={styles.button} type="button" onClick={exportCsv} disabled={loading || !!error}><Download size={14} />Export CSV</button></div>
              </div>

              {error && <div className={styles.error} role="alert"><span>{error}</span><button type="button" onClick={() => void loadReport()}>Retry</button></div>}

              <div className={styles.metrics}>
                {metrics.map((metric) => { const Icon = metric.icon; return <article className={styles.metric} key={metric.label}><div className={styles.metricTop}><span>{metric.label}</span><span className={styles.metricIcon}><Icon size={16} /></span></div><div className={styles.metricValue}>{loading ? "—" : numberFormat.format(metric.value)}</div><p className={styles.metricNote}>{metric.note}</p></article>; })}
              </div>

              <section className={styles.panel} aria-label="Inventory health report">
                <div className={styles.panelHeader}><h3 className={styles.panelTitle}>Inventory summary</h3><span className={styles.panelMeta}>{loading ? "Loading report…" : `${inventories.length} inventories`}</span></div>
                {loading ? <div className={styles.state}>Loading inventory data…</div> : !error && inventories.length === 0 ? <div className={styles.state}>No inventories yet. Create an inventory to start building reports.</div> : !error && <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Inventory</th><th>Items</th><th>Total units</th><th>Low stock</th><th>Out of stock</th><th>Health</th><th /></tr></thead><tbody>
                  {inventories.map((inventory) => {
                    const needsAttention = inventory.lowStockCount + inventory.outOfStockCount > 0;
                    return <tr key={inventory.id}><td><strong>{inventory.name}</strong></td><td>{numberFormat.format(inventory.itemCount)}</td><td>{numberFormat.format(inventory.totalUnits)}</td><td>{numberFormat.format(inventory.lowStockCount)}</td><td>{numberFormat.format(inventory.outOfStockCount)}</td><td><span className={`${styles.badge} ${inventory.outOfStockCount ? styles.badgeDanger : needsAttention ? styles.badgeWarn : styles.badgeGood}`}>{inventory.outOfStockCount ? "Out of stock" : needsAttention ? "Needs attention" : "Healthy"}</span></td><td><Link className={styles.tableLink} href={`/inventory/${inventory.id}`}>View inventory</Link></td></tr>;
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
