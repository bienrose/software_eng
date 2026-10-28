"use client";

import Image from "next/image";
import Link from "next/link";
import { Poppins } from "next/font/google";
import { ClipboardList, ArrowRight, Bell, Boxes, CircleAlert, FileBarChart, Home, LogOut, Package, RefreshCw, Sparkles, Trash2, TrendingUp } from "lucide-react";
import styles from "./collections.module.css";
import { useCallback, useEffect, useState } from "react";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/reports", label: "Inventory Reports", icon: FileBarChart },
  { href: "/replenishment", label: "Replenishment", icon: ClipboardList },
  { href: "/inventory_creator", label: "Inventory Creator", icon: Sparkles },
  { href: "/prediction", label: "Demand Prediction", icon: TrendingUp },
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
  const [deleteError, setDeleteError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const deleteInventory = async (inventory: InventorySummary) => {
    const itemLabel = inventory.itemCount === 1 ? "item" : "items";
    if (!window.confirm(`Delete "${inventory.name}" and remove its ${inventory.itemCount} ${itemLabel} from active views? Stock movement history will be kept.`)) return;
    setDeletingId(inventory.id);
    setDeleteError("");
    try {
      const response = await fetch(`/api/inventories/${inventory.id}`, { method: "DELETE" });
      if (!response.ok) {
        const result = await response.json() as { error?: string };
        throw new Error(result.error || "Could not delete inventory.");
      }
      setInventories((current) => current.filter((item) => item.id !== inventory.id));
    } catch (deleteFailure) {
      setDeleteError(deleteFailure instanceof Error ? deleteFailure.message : "Could not delete inventory.");
    } finally {
      setDeletingId(null);
    }
  };

  const totalItems = inventories.reduce((sum, inventory) => sum + inventory.itemCount, 0);

  return (
    <main className={`${poppins.className} app-shell dashboard-theme`}>
      <div className="app-body">
        <aside className="sidebar">
          <div className="sidebar-brand"><Image src="/aims-logo.png" alt="AIMS logo" width={48} height={48} className="object-contain" /><p className="sidebar-brand-name">AIMS</p></div>
          <nav className="sidebar-nav" aria-label="Main navigation">
            {navItems.map((item) => { const Icon = item.icon; const active = item.href === "/inventory"; return <Link key={item.href} href={item.href} className={`sidebar-link${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined}><Icon size={16} strokeWidth={1.75} />{item.label}</Link>; })}
          </nav>
          <div className="sidebar-footer"><div className="sidebar-user"><div className="sidebar-avatar">YB</div><div className="min-w-0"><p className="sidebar-user-name">Yther Ballesteros</p><p className="sidebar-user-role">Administrator</p></div></div><button className="sidebar-logout" type="button"><LogOut size={14} strokeWidth={1.75} />Log out</button></div>
        </aside>

        <section className="main">
          <header className="topbar"><div><h1 className="topbar-title">Inventory</h1><p className="topbar-subtitle">View your inventories, stock levels, and recent activity.</p></div><div className="topbar-tools"><button className="topbar-icon-btn" type="button" title="Notifications" aria-label="Notifications"><Bell size={16} strokeWidth={1.75} /></button><div className="topbar-profile">YB</div></div></header>
          <div className="page-content">
            <div className={`${styles.content} page-inner`}>
              <div className={`${styles.intro} inventory-collection-heading`}><div><p className={styles.eyebrow}>Inventory workspace</p><h2>Your inventories</h2><p>Open an inventory to review its items, stock levels, and recent movements.</p></div><Link href="/inventory_creator" className={styles.createLink}><Sparkles size={15} />Create inventory</Link></div>

              <div className={styles.summary}><Boxes size={17} /><span><strong>{inventories.length}</strong> inventories</span><i /><Package size={17} /><span><strong>{totalItems}</strong> tracked items</span></div>

              <section className={styles.grid} aria-label="Available inventories">
                {loading && <div className={styles.stateCard}>Loading inventories from aims_db…</div>}
                {!loading && error && <div className={`${styles.stateCard} ${styles.errorState}`} role="alert"><CircleAlert size={18} /><span>{error}</span><button type="button" onClick={() => void loadInventories()}><RefreshCw size={13} />Try again</button></div>}
                {!loading && deleteError && <div className={`${styles.stateCard} ${styles.errorState}`} role="alert"><CircleAlert size={18} /><span>{deleteError}</span><button type="button" onClick={() => setDeleteError("")}>Dismiss</button></div>}
                {!loading && !error && inventories.map((inventory, index) => <article className={styles.card} key={inventory.id}>
                  <div className={styles.cardTop}><span className={`${styles.cardIcon} ${styles[`tone${index % 3}`]}`}><Boxes size={19} /></span><button type="button" className={styles.deleteButton} onClick={() => void deleteInventory(inventory)} disabled={deletingId !== null} aria-label={`Delete ${inventory.name}`}><Trash2 size={14} />{deletingId === inventory.id ? "Deleting…" : "Delete"}</button></div>
                  <Link href={`/inventory/${inventory.id}`} className={styles.cardLink}>
                    <h3>{inventory.name}</h3><p className={styles.description}>{inventory.description || "Inventory records and adaptive item fields."}</p>
                    <div className={styles.cardMeta}><span><Package size={13} />{inventory.itemCount} {inventory.itemCount === 1 ? "item" : "items"}</span><span>{inventory.fieldCount} adaptive {inventory.fieldCount === 1 ? "field" : "fields"}</span></div>
                    <div className={styles.cardFooter}><span>{inventory.totalUnits.toLocaleString()} total units</span><span>Open inventory <ArrowRight size={13} /></span></div>
                  </Link>
                </article>)}
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

