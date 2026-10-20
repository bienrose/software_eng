"use client";

import Image from "next/image";
import Link from "next/link";
import { Poppins } from "next/font/google";
import { ArrowRight, Bell, Boxes, CircleAlert, Home, LogOut, Package, RefreshCw, Sparkles, TrendingUp } from "lucide-react";
import logo from "./logo.png";
import "../styles/dashboard.css";
import styles from "./collections.module.css";
import { useCallback, useEffect, useState } from "react";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/inventory_creator", label: "Inventory Creator", icon: Sparkles },
  { href: "/prediction", label: "Prediction", icon: TrendingUp },
];

type InventorySummary = {
  id: string;
  name: string;
  description: string | null;
  itemCount: number;
  totalUnits: number;
  fieldCount: number;
  lowStockCount: number;
  outOfStockCount: number;
};

export default function InventoryPage() {
  const [inventories, setInventories] = useState<InventorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadInventories = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/inventories", { cache: "no-store" });
      const result = await response.json() as { inventories?: InventorySummary[]; error?: string };
      if (!response.ok) throw new Error(result.error || "Could not load inventories.");
      setInventories(result.inventories ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load inventories.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void loadInventories(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadInventories]);
  const totalItems = inventories.reduce((sum, inventory) => sum + inventory.itemCount, 0);

  return (
    <main className={`${poppins.className} app-shell`}>
      <div className="app-body">
        <aside className="sidebar">
          <div className="sidebar-brand"><Image src={logo} alt="AIMS logo" width={48} height={48} className="object-contain" /><p className="sidebar-brand-name">AIMS</p></div>
          <nav className="sidebar-nav" aria-label="Main navigation">
            {navItems.map((item) => { const Icon = item.icon; const active = item.href === "/inventory"; return <Link key={item.href} href={item.href} className={`sidebar-link${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined}><Icon size={16} strokeWidth={1.75} />{item.label}</Link>; })}
          </nav>
          <div className="sidebar-footer"><div className="sidebar-user"><div className="sidebar-avatar">JD</div><div className="min-w-0"><p className="sidebar-user-name">John Doe</p><p className="sidebar-user-role">Administrator</p></div></div><button className="sidebar-logout" type="button"><LogOut size={14} strokeWidth={1.75} />Log out</button></div>
        </aside>

        <section className="main">
          <header className="topbar"><div><h1 className="topbar-title">Inventory</h1><p className="topbar-subtitle">Choose an inventory to view its stock and activity</p></div><button className="topbar-icon-btn" type="button" title="Notifications" aria-label="Notifications"><Bell size={16} strokeWidth={1.75} /></button></header>
          <div className="page-content">
            <div className={`${styles.content} page-inner`}>
              <div className={styles.intro}><div><p className={styles.eyebrow}>Inventory workspace</p><h2>Your inventories</h2><p>Open an inventory to review its items, stock levels, and recent movements.</p></div><Link href="/inventory_creator" className={styles.createLink}><Sparkles size={15} />Create inventory</Link></div>

              <div className={styles.summary}><Boxes size={17} /><span><strong>{inventories.length}</strong> inventories</span><i /><Package size={17} /><span><strong>{totalItems}</strong> tracked items</span></div>

              <section className={styles.grid} aria-label="Available inventories">
                {loading && <div className={styles.stateCard}>Loading inventories from aims_db…</div>}
                {!loading && error && <div className={`${styles.stateCard} ${styles.errorState}`} role="alert"><CircleAlert size={18} /><span>{error}</span><button type="button" onClick={() => void loadInventories()}><RefreshCw size={13} />Try again</button></div>}
                {!loading && !error && inventories.map((inventory, index) => <Link href={`/inventory/${inventory.id}`} className={styles.card} key={inventory.id}>
                  <div className={styles.cardTop}><span className={`${styles.cardIcon} ${styles[`tone${index % 3}`]}`}><Boxes size={19} /></span><span className={styles.openIcon}><ArrowRight size={16} /></span></div>
                  <h3>{inventory.name}</h3><p className={styles.description}>{inventory.description || "Inventory records and adaptive item fields."}</p>
                  <div className={styles.cardMeta}><span><Package size={13} />{inventory.itemCount} {inventory.itemCount === 1 ? "item" : "items"}</span><span>{inventory.fieldCount} adaptive {inventory.fieldCount === 1 ? "field" : "fields"}</span></div>
                  <div className={styles.cardFooter}><span>{inventory.totalUnits.toLocaleString()} total units</span><span>Open inventory <ArrowRight size={13} /></span></div>
                </Link>)}
              </section>

              {!loading && !error && inventories.length === 0 && <div className={styles.emptyCard}><Boxes size={24} /><h3>No inventories yet</h3><p>Create an inventory to see it listed here.</p><Link href="/inventory_creator" className={styles.createLink}><Sparkles size={14} />Create your first inventory</Link></div>}
              <p className={styles.demoNote}>Inventory records load from the MySQL database configured for this app.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
