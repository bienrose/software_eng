"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { Poppins } from "next/font/google";
import {
  ArrowDownToLine, ArrowLeft, ArrowUpFromLine, Bell, Boxes, CheckCircle2,
  CircleAlert, ClipboardList, FileBarChart, Home, LogOut, Package, Sparkles, TrendingUp,
} from "lucide-react";
import styles from "./movement.module.css";
type MovementKind = "stock_in" | "stock_out";
type InventoryItem = { id: string; inventoryId: string; inventoryName: string; code: string | null; name: string; unit: string; quantity: number; reorderLevel: number };
type InventorySummary = { id: string; name: string };
type InventoryDetailResponse = { inventory: { id: string; name: string }; items: InventoryItem[] };

function getStockStatus(item: InventoryItem) {
  if (item.quantity <= 0) return "out";
  if (item.quantity <= item.reorderLevel) return "low";
  return "in";
}

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/reports", label: "Inventory Reports", icon: FileBarChart },
  { href: "/replenishment", label: "Replenishment", icon: ClipboardList },
  { href: "/inventory_creator", label: "Inventory Creator", icon: Sparkles },
  { href: "/prediction", label: "Demand Prediction", icon: TrendingUp },
];

export default function MovementForm({ kind }: { kind: MovementKind }) {
  const isStockIn = kind === "stock_in";
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [itemId, setItemId] = useState("");
  const [inventoryId, setInventoryId] = useState("");
  const [currentInventoryName, setCurrentInventoryName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(async (selectedInventoryId: string) => {
    if (selectedInventoryId) {
      const response = await fetch(`/api/inventories/${encodeURIComponent(selectedInventoryId)}`, { cache: "no-store" });
      const result = await response.json() as InventoryDetailResponse & { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not load inventory items.");
      setCurrentInventoryName(result.inventory.name);
      setItems(result.items.map((item) => ({ ...item, inventoryId: result.inventory.id, inventoryName: result.inventory.name })));
      return;
    }
    setCurrentInventoryName("");
    const listResponse = await fetch("/api/inventories", { cache: "no-store" });
    const list = await listResponse.json() as { inventories?: InventorySummary[]; error?: string };
    if (!listResponse.ok) throw new Error(list.error || "Could not load inventories.");
    const details = await Promise.all((list.inventories ?? []).map(async (inventory) => {
      const response = await fetch(`/api/inventories/${encodeURIComponent(inventory.id)}`, { cache: "no-store" });
      const result = await response.json() as InventoryDetailResponse & { error?: string };
      if (!response.ok) throw new Error(result.error || `Could not load ${inventory.name}.`);
      return result.items.map((item) => ({ ...item, inventoryId: result.inventory.id, inventoryName: result.inventory.name }));
    }));
    setItems(details.flat());
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const selectedInventoryId = params.get("inventoryId") ?? "";
      setInventoryId(selectedInventoryId);
      setItemId(params.get("itemId") ?? "");
      fetchItems(selectedInventoryId).catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Could not load inventory items.")).finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [fetchItems]);

  const inventory = inventoryId ? items.find((item) => item.inventoryId === inventoryId) : undefined;
  const availableItems = inventoryId ? items.filter((item) => item.inventoryId === inventoryId) : items;
  const selectedItem = items.find((item) => item.id === itemId);
  const selectedInventoryName = currentInventoryName || inventory?.inventoryName || selectedItem?.inventoryName;
  const amount = Number(quantity);
  const projected = selectedItem && Number.isFinite(amount) && amount > 0
    ? selectedItem.quantity + (isStockIn ? amount : -amount)
    : selectedItem?.quantity;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      const response = await fetch(`/api/inventory-items/${encodeURIComponent(itemId)}/movements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, quantity: amount, reference, notes }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not record this movement.");
      await fetchItems(inventoryId);
      setQuantity("");
      setReference("");
      setNotes("");
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not record this movement.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={`${poppins.className} app-shell dashboard-theme`}>
      <div className="app-body">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <Image src="/aims-logo.png" alt="AIMS logo" width={48} height={48} className="object-contain" />
            <p className="sidebar-brand-name">AIMS</p>
          </div>
          <nav className="sidebar-nav" aria-label="Main navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.href === "/inventory";
              return <Link key={item.href} href={item.href} className={`sidebar-link${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined}>
                <Icon size={16} strokeWidth={1.75} />{item.label}
              </Link>;
            })}
          </nav>
          <div className="sidebar-footer">
            <div className="sidebar-user"><div className="sidebar-avatar">YB</div><div className="min-w-0"><p className="sidebar-user-name">Yther Ballesteros</p><p className="sidebar-user-role">Administrator</p></div></div>
            <button className="sidebar-logout" type="button"><LogOut size={14} strokeWidth={1.75} />Log out</button>
          </div>
        </aside>

        <section className="main">
          <header className="topbar">
            <div><h1 className="topbar-title">{isStockIn ? "Stock In" : "Stock Out"}</h1><p className="topbar-subtitle">{isStockIn ? "Record new supplies received" : "Record items issued or distributed"}</p></div>
            <button className="topbar-icon-btn" type="button" title="Notifications" aria-label="Notifications"><Bell size={16} strokeWidth={1.75} /></button>
          </header>
          <div className="page-content">
            <div className={`${styles.content} page-inner`}>
              <div className={styles.breadcrumb}><Link href={selectedInventoryName && inventoryId ? `/inventory/${inventoryId}` : "/inventory"}><ArrowLeft size={14} /> {selectedInventoryName ?? "All inventories"}</Link><span>/</span><span>{isStockIn ? "Stock In" : "Stock Out"}</span></div>
              <div className={styles.demoNotice}><CircleAlert size={15} /><span>Stock movements are recorded in the MySQL transaction history.</span></div>
              {loading && <p className={styles.emptyPreview}>Loading items from aims_db…</p>}
              <div className={styles.layout}>
                <section className={styles.formCard}>
                  <div className={styles.heading}>
                    <div className={`${styles.headingIcon} ${isStockIn ? styles.inIcon : styles.outIcon}`}>
                      {isStockIn ? <ArrowDownToLine size={20} /> : <ArrowUpFromLine size={20} />}
                    </div>
                    <div><p className={styles.eyebrow}>Inventory movement</p><h2>{isStockIn ? "Receive stock" : "Issue stock"}</h2><p>{isStockIn ? "Add delivered items to your on-hand quantity." : "Subtract items issued for use or distribution."}</p></div>
                  </div>

                  <form onSubmit={submit} className={styles.form}>
                    <label className={styles.field}><span>Inventory item <b>*</b></span>
                      <select required value={itemId} onChange={(event) => { setItemId(event.target.value); setSaved(false); }} disabled={loading}>
                        <option value="">Choose an item</option>
                        {availableItems.map((item) => <option key={item.id} value={item.id}>{item.name}{item.code ? ` · ${item.code}` : ""}{!inventoryId ? ` — ${item.inventoryName}` : ""}</option>)}
                      </select>
                    </label>

                    {selectedItem && <div className={styles.stockContext}>
                      <div><span>Current on hand</span><strong>{selectedItem.quantity.toLocaleString()} <small>{selectedItem.unit}</small></strong></div>
                      <span className={`${styles.status} ${styles[`status${getStockStatus(selectedItem)}`]}`}>{getStockStatus(selectedItem) === "out" ? "Out of stock" : getStockStatus(selectedItem) === "low" ? "Low stock" : "In stock"}</span>
                    </div>}

                    <label className={styles.field}><span>Quantity <b>*</b></span>
                      <div className={styles.quantityInput}><input required type="number" min="0.001" step="0.001" inputMode="decimal" value={quantity} onChange={(event) => { setQuantity(event.target.value); setSaved(false); }} placeholder="Enter quantity" /><span>{selectedItem?.unit ?? "units"}</span></div>
                    </label>
                    <label className={styles.field}><span>Reference number <small>Optional</small></span><input value={reference} onChange={(event) => setReference(event.target.value)} placeholder={isStockIn ? "e.g. PO-2026-1043" : "e.g. DR-2026-029"} maxLength={80} /></label>
                    <label className={styles.field}><span>Notes <small>Optional</small></span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={isStockIn ? "Supplier, delivery details, or condition" : "Recipient, destination, or reason for issue"} rows={3} maxLength={500} /></label>

                    {selectedItem && amount > selectedItem.quantity && !isStockIn && <p className={styles.inlineWarning}><CircleAlert size={14} /> Quantity exceeds available stock.</p>}
                    {error && <p className={styles.errorMessage} role="alert"><CircleAlert size={15} />{error}</p>}
                    {saved && <p className={styles.successMessage} role="status"><CheckCircle2 size={15} />Stock movement recorded. Inventory is up to date.</p>}
                    <div className={styles.formActions}><Link href={selectedInventoryName && inventoryId ? `/inventory/${inventoryId}` : "/inventory"} className={styles.cancelButton}>Cancel</Link><button type="submit" disabled={saving || loading || availableItems.length === 0} className={isStockIn ? styles.submitIn : styles.submitOut}>{isStockIn ? <ArrowDownToLine size={15} /> : <ArrowUpFromLine size={15} />}{saving ? "Saving…" : isStockIn ? "Record stock in" : "Record stock out"}</button></div>
                  </form>
                </section>

                <aside className={styles.sideColumn}>
                  <section className={styles.balanceCard}>
                    <div className={styles.balanceTitle}><Package size={16} /><h3>Balance preview</h3></div>
                    {selectedItem ? <><p className={styles.balanceItem}>{selectedItem.name}</p><div className={styles.balanceMath}><span>{selectedItem.quantity.toLocaleString()}</span><span className={isStockIn ? styles.plus : styles.minus}>{quantity && amount > 0 ? `${isStockIn ? "+" : "−"}${amount.toLocaleString()}` : "—"}</span><strong>{projected?.toLocaleString()}</strong></div><p className={styles.balanceUnit}>{selectedItem.unit} after this movement</p></> : <p className={styles.emptyPreview}>Choose an item to preview its balance.</p>}
                  </section>
                  <section className={styles.tipCard}><div className={styles.tipIcon}><CircleAlert size={16} /></div><div><h3>{isStockIn ? "Receiving checklist" : "Issuing checklist"}</h3><p>{isStockIn ? "Confirm the delivered quantity and add a purchase order or delivery reference when available." : "Confirm the recipient and destination. Stock out cannot exceed the quantity currently on hand."}</p></div></section>
                </aside>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}




