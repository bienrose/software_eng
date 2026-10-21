"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Poppins } from "next/font/google";
import {
  ArrowDownToLine, ArrowRight, ArrowUpFromLine, Bell, Boxes, CircleAlert,
  Clock3, FileBarChart, Home, LogOut, PackagePlus, RefreshCw, Search, Sparkles, TrendingUp, X,
} from "lucide-react";
import styles from "./inventory.module.css";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/reports", label: "Inventory Reports", icon: FileBarChart },
  { href: "/inventory_creator", label: "Inventory Creator", icon: Sparkles },
  { href: "/prediction", label: "Demand Prediction", icon: TrendingUp },
];

type InventoryField = { id: string; key: string; label: string; dataType: string; required: boolean; options: unknown[]; displayOrder: number };
type InventoryItem = {
  id: string; code: string | null; name: string; description: string | null; unit: string;
  quantity: number; reorderLevel: number; customAttributes: Record<string, unknown>; createdAt: string; updatedAt: string;
};
type Movement = {
  id: string; itemId: string; itemName: string; kind: "stock_in" | "stock_out";
  quantity: number; balanceAfter: number; reference: string | null; notes: string | null; occurredAt: string;
};
type InventoryDetail = {
  inventory: { id: string; name: string; description: string | null; createdAt: string; schemaVersion: number; displayLabels: Record<string, unknown> };
  fields: InventoryField[]; items: InventoryItem[]; movements: Movement[];
};
type InventoryTableColumn = { key: string; label: string; field?: InventoryField };
const EMPTY_ITEMS: InventoryItem[] = [];
const EMPTY_MOVEMENTS: Movement[] = [];
const EMPTY_FIELDS: InventoryField[] = [];
const coreColumnDefaults: Record<string, string> = {
  name: "Item name", code: "Item code", description: "Description", quantity: "Quantity", unit: "Unit",
  reorderLevel: "Reorder level", status: "Status", updated: "Last update",
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function formatMovementDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function getStatus(item: InventoryItem) {
  if (item.quantity <= 0) return { label: "Out of stock", className: styles.statusout };
  if (item.quantity <= item.reorderLevel) return { label: "Low stock", className: styles.statuslow };
  return { label: "In stock", className: styles.statusin };
}

export default function InventoryDetailPage({ inventoryId }: { inventoryId: string }) {
  const [data, setData] = useState<InventoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [editMethodOpen, setEditMethodOpen] = useState(false);

  const loadInventory = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/inventories/${encodeURIComponent(inventoryId)}`, { cache: "no-store" });
      const result = await response.json() as InventoryDetail & { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not load this inventory.");
      setData(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load this inventory.");
    } finally {
      setLoading(false);
    }
  }, [inventoryId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void loadInventory(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadInventory]);

  const items = data?.items ?? EMPTY_ITEMS;
  const movements = data?.movements ?? EMPTY_MOVEMENTS;
  const schemaFields = data?.fields ?? EMPTY_FIELDS;
  const tableColumns = useMemo<InventoryTableColumn[]>(() => {
    const labels = data?.inventory.displayLabels ?? {};
    const fallbackOrder = ["name", "code", "description", "quantity", "unit", "reorderLevel", "status", "updated",
      ...schemaFields.map((field) => `field:${field.label}`)];
    const storedOrder = labels.columnOrder;
    const order = Array.isArray(storedOrder) ? storedOrder.filter((key): key is string => typeof key === "string") : fallbackOrder;
    return order.flatMap((key) => {
      if (key.startsWith("field:")) {
        const field = schemaFields.find((entry) => entry.label === key.slice("field:".length));
        return field ? [{ key, label: field.label, field }] : [];
      }
      if (!Object.hasOwn(coreColumnDefaults, key)) return [];
      const label = labels[key];
      return [{ key, label: typeof label === "string" && label ? label : coreColumnDefaults[key] }];
    });
  }, [data?.inventory.displayLabels, schemaFields]);
  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => item.name.toLowerCase().includes(query)
      || (item.code ?? "").toLowerCase().includes(query)
        || (item.description ?? "").toLowerCase().includes(query)
      || Object.values(item.customAttributes).some((value) => String(value ?? "").toLowerCase().includes(query)));
  }, [items, search]);
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
  const lowStockCount = items.filter((item) => item.quantity > 0 && item.quantity <= item.reorderLevel).length;
  const outOfStockCount = items.filter((item) => item.quantity <= 0).length;

  function renderInventoryCell(column: InventoryTableColumn, item: InventoryItem) {
    if (column.field) {
      return <td key={column.key}><span className={styles.categoryText}>{String(item.customAttributes[column.field.key] ?? "—")}</span></td>;
    }
    if (column.key === "name") return <td key={column.key}><span className={styles.itemName}>{item.name}</span></td>;
    if (column.key === "code") return <td key={column.key}><span className={styles.itemCode}>{item.code || "—"}</span></td>;
    if (column.key === "description") return <td key={column.key}><span className={styles.categoryText}>{item.description || "—"}</span></td>;
    if (column.key === "quantity") return <td key={column.key}><span className={styles.quantityValue}>{item.quantity.toLocaleString()}</span></td>;
    if (column.key === "unit") return <td key={column.key}><span className={styles.quantityUnit}>{item.unit}</span></td>;
    if (column.key === "reorderLevel") return <td key={column.key}><span className={styles.reorderValue}>{item.reorderLevel.toLocaleString()} {item.unit}</span></td>;
    if (column.key === "status") {
      const status = getStatus(item);
      return <td key={column.key}><span className={`${styles.statusBadge} ${status.className}`}>{status.label}</span></td>;
    }
    if (column.key === "updated") return <td key={column.key}><span className={styles.updatedText}>{formatDate(item.updatedAt)}</span></td>;
    return <td key={column.key}>—</td>;
  }

  return (
    <main className={`${poppins.className} app-shell dashboard-theme`}>
      <div className="app-body">
        <aside className="sidebar">
          <div className="sidebar-brand"><Image src="/aims-logo.png" alt="AIMS logo" width={48} height={48} className="object-contain" /><p className="sidebar-brand-name">AIMS</p></div>
          <nav className="sidebar-nav" aria-label="Main navigation">
            {navItems.map((item) => { const Icon = item.icon; const active = item.href === "/inventory"; return <Link key={item.href} href={item.href} className={`sidebar-link${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined}><Icon size={16} strokeWidth={1.75} />{item.label}</Link>; })}
          </nav>
          <div className="sidebar-footer"><div className="sidebar-user"><div className="sidebar-avatar">JD</div><div className="min-w-0"><p className="sidebar-user-name">John Doe</p><p className="sidebar-user-role">Administrator</p></div></div><button className="sidebar-logout" type="button"><LogOut size={14} strokeWidth={1.75} />Log out</button></div>
        </aside>

        <section className="main">
          <header className="topbar"><div><h1 className="topbar-title">{data?.inventory.name ?? "Inventory"}</h1><p className="topbar-subtitle">Items, adaptive fields, and stock activity from aims_db</p></div><button className="topbar-icon-btn" type="button" title="Notifications" aria-label="Notifications"><Bell size={16} strokeWidth={1.75} /></button></header>
          <div className="page-content">
            <div className={`${styles.content} page-inner`}>
              <Link href="/inventory" className={styles.backLink}><ArrowRight size={13} />All inventories</Link>
              {error && <div className={styles.demoNotice} role="alert"><CircleAlert size={15} /><span>{error}</span><button type="button" onClick={() => void loadInventory()}><RefreshCw size={13} />Retry</button></div>}
              {loading && <div className={styles.loadingState}>Loading inventory from aims_db…</div>}

              {!loading && data && <>
                {editMethodOpen && <div className={styles.editMethodOverlay} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditMethodOpen(false); }}>
                  <section className={styles.editMethodDialog} role="dialog" aria-modal="true" aria-labelledby="edit-method-title">
                    <button type="button" className={styles.editMethodClose} onClick={() => setEditMethodOpen(false)} aria-label="Close"><X size={17} /></button>
                    <p className={styles.eyebrow}>Edit {data.inventory.name}</p><h2 id="edit-method-title">Choose an editing method</h2>
                    <p>Choose how you want to update this inventory.</p>
                    <div className={styles.editMethodChoices}>
                      <Link href={`/inventory/${encodeURIComponent(inventoryId)}/edit/manual`}><PackagePlus size={18} /><span><strong>Manual</strong><small>Edit the inventory details and items in a table.</small></span><ArrowRight size={15} /></Link>
                      <button type="button" disabled aria-disabled="true"><Sparkles size={18} /><span><strong>Automatic</strong><small>Automatic editing will be available later.</small></span><span className={styles.comingSoon}>Coming soon</span></button>
                    </div>
                  </section>
                </div>}
                <div className={styles.pageHeading}>
                  <div><p className={styles.eyebrow}>Inventory workspace · schema v{data.inventory.schemaVersion}</p><h2>{data.inventory.name}</h2><p className={styles.headingDescription}>{data.inventory.description || "Manage items and stock levels for this inventory."}</p></div>
                  <div className={styles.headingActions}>
                    <button type="button" className={styles.secondaryAction} onClick={() => setEditMethodOpen(true)}><PackagePlus size={14} />Edit inventory</button>
                    <Link href={`/inventory/stock-in?inventoryId=${encodeURIComponent(inventoryId)}`} className={styles.stockInAction}><ArrowDownToLine size={15} />Stock in</Link>
                    <Link href={`/inventory/stock-out?inventoryId=${encodeURIComponent(inventoryId)}`} className={styles.stockOutAction}><ArrowUpFromLine size={15} />Stock out</Link>
                  </div>
                </div>

                <div className={styles.summaryGrid}>
                  <article className={styles.summaryCard}><div className={styles.summaryIcon}><Boxes size={17} /></div><span className={styles.summaryLabel}>Total items</span><strong>{items.length}</strong><span className={styles.summaryFoot}>From database</span></article>
                  <article className={styles.summaryCard}><div className={`${styles.summaryIcon} ${styles.summaryIconBlue}`}><PackagePlus size={17} /></div><span className={styles.summaryLabel}>Adaptive fields</span><strong>{schemaFields.length}</strong><span className={styles.summaryFoot}>Active schema fields</span></article>
                  <article className={styles.summaryCard}><div className={`${styles.summaryIcon} ${styles.summaryIconYellow}`}><CircleAlert size={17} /></div><span className={styles.summaryLabel}>Low stock</span><strong>{lowStockCount}</strong><span className={styles.summaryFoot}>At or below reorder level</span></article>
                  <article className={styles.summaryCard}><div className={`${styles.summaryIcon} ${styles.summaryIconRed}`}><Boxes size={17} /></div><span className={styles.summaryLabel}>Total units</span><strong>{totalUnits.toLocaleString()}</strong><span className={styles.summaryFoot}>{outOfStockCount} out of stock</span></article>
                </div>

                <section className={styles.inventoryPanel} aria-labelledby="inventory-items-title">
                  <div className={styles.panelHeading}><div><h3 id="inventory-items-title">Inventory items</h3><p>{filteredItems.length} items shown</p></div><button type="button" className={styles.addItemLink} onClick={() => void loadInventory()}><RefreshCw size={13} />Refresh</button></div>
                  <div className={styles.filterBar}><label className={styles.searchBox}><Search size={15} /><span className={styles.visuallyHidden}>Search items</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by item, code, or adaptive field" /></label></div>
                  <div className={styles.tableWrap}><table className={styles.inventoryTable}>
                    <thead><tr>{tableColumns.map((column) => <th key={column.key}>{column.label}</th>)}<th><span className={styles.visuallyHidden}>Actions</span></th></tr></thead>
                    <tbody>{filteredItems.length === 0
                      ? <tr><td colSpan={tableColumns.length + 1} className={styles.emptyState}>{items.length ? "No items match your search." : "No items have been added to this inventory yet."}</td></tr>
                      : filteredItems.map((item) => <tr key={item.id}>
                        {tableColumns.map((column) => renderInventoryCell(column, item))}
                        <td><div className={styles.rowActions}><Link href={`/inventory/stock-in?itemId=${encodeURIComponent(item.id)}&inventoryId=${encodeURIComponent(inventoryId)}`} className={styles.rowActionIn} aria-label={`Stock in ${item.name}`} title={`Stock in ${item.name}`}><ArrowDownToLine size={14} /></Link><Link href={`/inventory/stock-out?itemId=${encodeURIComponent(item.id)}&inventoryId=${encodeURIComponent(inventoryId)}`} className={styles.rowActionOut} aria-label={`Stock out ${item.name}`} title={`Stock out ${item.name}`}><ArrowUpFromLine size={14} /></Link></div></td>
                      </tr>)}
                    </tbody>
                  </table></div>
                </section>

                <section className={styles.activityPanel} aria-labelledby="recent-movements-title">
                  <div className={styles.panelHeading}><div><h3 id="recent-movements-title">Recent stock movements</h3><p>Recorded transaction history</p></div><Clock3 size={17} className={styles.activityHeadingIcon} /></div>
                  <div className={styles.movementList}>{movements.length === 0 ? <p className={styles.emptyState}>No stock movements recorded yet.</p> : movements.slice(0, 4).map((movement) => { const isStockIn = movement.kind === "stock_in"; return <div className={styles.movementRow} key={movement.id}>
                    <div className={`${styles.movementIcon} ${isStockIn ? styles.movementIconIn : styles.movementIconOut}`}>{isStockIn ? <ArrowDownToLine size={15} /> : <ArrowUpFromLine size={15} />}</div>
                    <div className={styles.movementDetails}><strong>{movement.itemName}</strong><span>{isStockIn ? "Stock received" : "Stock released"}{movement.reference ? ` · ${movement.reference}` : ""}</span></div>
                    <div className={styles.movementAmount}><strong className={isStockIn ? styles.amountPositive : styles.amountNegative}>{isStockIn ? "+" : "−"}{movement.quantity.toLocaleString()}</strong><span>Balance {movement.balanceAfter.toLocaleString()} · {formatMovementDate(movement.occurredAt)}</span></div>
                  </div>; })}</div>
                  <Link href={`/inventory/stock-in?inventoryId=${encodeURIComponent(inventoryId)}`} className={styles.activityLink}>Record a movement <ArrowRight size={14} /></Link>
                </section>
              </>}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
