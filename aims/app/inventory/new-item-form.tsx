"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Poppins } from "next/font/google";
import { ArrowLeft, Bell, Boxes, CircleAlert, FileBarChart, Home, LogOut, PackagePlus, Save, Sparkles, TrendingUp } from "lucide-react";
import styles from "./new-item.module.css";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/reports", label: "Inventory Reports", icon: FileBarChart },
  { href: "/inventory_creator", label: "Inventory Creator", icon: Sparkles },
  { href: "/prediction", label: "Demand Prediction", icon: TrendingUp },
];

type SchemaField = { id: string; key: string; label: string; dataType: string; required: boolean; options: unknown[] };
type InventoryResponse = { inventory: { id: string; name: string }; fields: SchemaField[] };

function inputType(dataType: string) {
  if (dataType === "date") return "date";
  if (dataType === "datetime") return "datetime-local";
  if (dataType === "integer" || dataType === "decimal") return "number";
  return "text";
}

export default function NewInventoryItemForm({ inventoryId }: { inventoryId: string }) {
  const router = useRouter();
  const [inventory, setInventory] = useState<InventoryResponse["inventory"] | null>(null);
  const [fields, setFields] = useState<SchemaField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [reorderLevel, setReorderLevel] = useState("0");
  const [customAttributes, setCustomAttributes] = useState<Record<string, string>>({});

  const loadInventory = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/inventories/${encodeURIComponent(inventoryId)}`, { cache: "no-store" });
      const result = await response.json() as InventoryResponse & { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not load this inventory.");
      setInventory(result.inventory);
      setFields(result.fields);
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/inventories/${encodeURIComponent(inventoryId)}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, itemCode, description, unit, quantity: Number(quantity), reorderLevel: Number(reorderLevel), customAttributes }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not save this item.");
      router.push(`/inventory/${encodeURIComponent(inventoryId)}`);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save this item.");
    } finally {
      setSaving(false);
    }
  }

  return <main className={`${poppins.className} app-shell dashboard-theme`}><div className="app-body">
    <aside className="sidebar"><div className="sidebar-brand"><Image src="/aims-logo.png" alt="AIMS logo" width={48} height={48} className="object-contain" /><p className="sidebar-brand-name">AIMS</p></div><nav className="sidebar-nav" aria-label="Main navigation">{navItems.map((item) => { const Icon = item.icon; const active = item.href === "/inventory"; return <Link key={item.href} href={item.href} className={`sidebar-link${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined}><Icon size={16} strokeWidth={1.75} />{item.label}</Link>; })}</nav><div className="sidebar-footer"><div className="sidebar-user"><div className="sidebar-avatar">JD</div><div className="min-w-0"><p className="sidebar-user-name">John Doe</p><p className="sidebar-user-role">Administrator</p></div></div><button className="sidebar-logout" type="button"><LogOut size={14} strokeWidth={1.75} />Log out</button></div></aside>
    <section className="main"><header className="topbar"><div><h1 className="topbar-title">Add inventory item</h1><p className="topbar-subtitle">{inventory?.name ?? "Inventory"}</p></div><button className="topbar-icon-btn" type="button" title="Notifications" aria-label="Notifications"><Bell size={16} strokeWidth={1.75} /></button></header>
      <div className="page-content"><div className={`${styles.content} page-inner`}>
        <Link href={`/inventory/${encodeURIComponent(inventoryId)}`} className={styles.backLink}><ArrowLeft size={14} />Back to {inventory?.name ?? "inventory"}</Link>
        {loading && <div className={styles.notice}>Loading inventory fields…</div>}
        {error && <div className={styles.error} role="alert"><CircleAlert size={15} />{error}{!loading && <button type="button" onClick={() => void loadInventory()}>Retry</button>}</div>}
        {!loading && inventory && <form className={styles.formCard} onSubmit={submit}>
          <div className={styles.heading}><div className={styles.icon}><PackagePlus size={18} /></div><div><h2>New item in {inventory.name}</h2><p>Complete the core details and the fields defined by this inventory.</p></div></div>
          <div className={styles.fields}>
            <label>Item name <span>*</span><input required maxLength={180} value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label>Item code<input maxLength={80} value={itemCode} onChange={(event) => setItemCode(event.target.value)} /></label>
            <label>Description<textarea rows={2} maxLength={5000} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
            <label>Unit <span>*</span><input required maxLength={40} value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="e.g. boxes" /></label>
            <label>Quantity on hand<input required type="number" min="0" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
            <label>Reorder level<input required type="number" min="0" step="0.001" value={reorderLevel} onChange={(event) => setReorderLevel(event.target.value)} /></label>
            {fields.map((field) => <label key={field.id}>{field.label}{field.required && <span> *</span>}
              {field.dataType === "enum" && Array.isArray(field.options) && field.options.length > 0
                ? <select required={field.required} value={customAttributes[field.key] ?? ""} onChange={(event) => setCustomAttributes((current) => ({ ...current, [field.key]: event.target.value }))}><option value="">Choose…</option>{field.options.map((option) => <option key={String(option)} value={String(option)}>{String(option)}</option>)}</select>
                : field.dataType === "boolean"
                  ? <select required={field.required} value={customAttributes[field.key] ?? ""} onChange={(event) => setCustomAttributes((current) => ({ ...current, [field.key]: event.target.value }))}><option value="">Choose…</option><option value="true">Yes</option><option value="false">No</option></select>
                  : <input required={field.required} type={inputType(field.dataType)} step={field.dataType === "decimal" ? "0.001" : undefined} value={customAttributes[field.key] ?? ""} onChange={(event) => setCustomAttributes((current) => ({ ...current, [field.key]: event.target.value }))} />}
            </label>)}
          </div>
          <div className={styles.actions}><Link href={`/inventory/${encodeURIComponent(inventoryId)}`} className={styles.cancel}>Cancel</Link><button type="submit" disabled={saving}><Save size={14} />{saving ? "Saving…" : "Save item"}</button></div>
        </form>}
      </div></div>
    </section>
  </div></main>;
}
