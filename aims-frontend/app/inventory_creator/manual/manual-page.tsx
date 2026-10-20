"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Poppins } from "next/font/google";
import {
  ArrowLeft, ArrowRight, Boxes, Bell, Check, Home, LogOut, PackagePlus, Plus,
  Sparkles, SquarePen, TrendingUp, Trash2,
} from "lucide-react";
import logo from "../../inventory/logo.png";
import "../../styles/dashboard.css";
import styles from "./manual.module.css";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/inventory_creator", label: "Inventory Creator", icon: Sparkles },
  { href: "/prediction", label: "Prediction", icon: TrendingUp },
];

type InventoryRow = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  reorderLevel: number;
  updated: string;
  customFields: Record<string, string>;
};

type ColumnLabels = Record<"name" | "category" | "quantity" | "unit" | "reorderLevel" | "status" | "updated", string>;
type CustomColumn = { id: string; label: string };

function currentDate() {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date());
}

function stockStatus(row: Pick<InventoryRow, "quantity" | "reorderLevel">) {
  if (row.quantity <= 0) return { label: "Out of stock", className: styles.statusOut };
  if (row.quantity <= row.reorderLevel) return { label: "Low stock", className: styles.statusLow };
  return { label: "In stock", className: styles.statusIn };
}

export default function ManualInventoryPage() {
  const router = useRouter();
  const [inventoryName, setInventoryName] = useState("");
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [columnLabels, setColumnLabels] = useState<ColumnLabels>({
    name: "Item name", category: "Category", quantity: "Quantity", unit: "Unit",
    reorderLevel: "Reorder level", status: "Status", updated: "Last update",
  });
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
  const [newColumnName, setNewColumnName] = useState("");
  const [draftCustomFields, setDraftCustomFields] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [reorderLevel, setReorderLevel] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const draftVisible = Boolean(name || category || quantity || unit || reorderLevel);
  const draftReady = Boolean(inventoryName.trim() && name.trim() && category.trim() && quantity !== "" && unit.trim());

  function handleAddItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draftReady) return;
    setRows((current) => [{
      id: `manual-${Date.now()}`,
      name: name.trim(),
      category: category.trim(),
      quantity: Number(quantity),
      unit: unit.trim(),
      reorderLevel: Number(reorderLevel || 0),
      updated: currentDate(),
      customFields: { ...draftCustomFields },
    }, ...current]);
    setName("");
    setCategory("");
    setQuantity("");
    setUnit("");
    setReorderLevel("");
    setDraftCustomFields({});
  }

  function updateRow(id: string, field: keyof Omit<InventoryRow, "id" | "updated">, value: string) {
    setRows((current) => current.map((row) => {
      if (row.id !== id) return row;
      const updated = { ...row, updated: currentDate() };
      if (field === "quantity") updated.quantity = Number(value || 0);
      else if (field === "reorderLevel") updated.reorderLevel = Number(value || 0);
      else if (field === "name") updated.name = value;
      else if (field === "category") updated.category = value;
      else updated.unit = value;
      return updated;
    }));
  }

  function addColumn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const label = newColumnName.trim();
    if (!label) return;
    const id = `custom-${Date.now()}`;
    setCustomColumns((current) => [...current, { id, label }]);
    setRows((current) => current.map((row) => ({ ...row, customFields: { ...row.customFields, [id]: "" } })));
    setNewColumnName("");
  }

  function removeColumn(id: string) {
    setCustomColumns((current) => current.filter((column) => column.id !== id));
    setRows((current) => current.map((row) => {
      const customFields = { ...row.customFields };
      delete customFields[id];
      return { ...row, customFields };
    }));
    setDraftCustomFields((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  function updateCustomField(rowId: string, columnId: string, value: string) {
    setRows((current) => current.map((row) => row.id === rowId
      ? { ...row, customFields: { ...row.customFields, [columnId]: value }, updated: currentDate() }
      : row));
  }

  async function saveInventory() {
    const trimmedName = inventoryName.trim();
    if (!trimmedName) {
      setSaveError("Enter an inventory name before saving.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const response = await fetch("/api/inventories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          description: `Inventory created manually: ${trimmedName}`,
          displayLabels: columnLabels,
          generationMethod: "manual",
          fields: [
            { label: columnLabels.category, dataType: "text", required: true },
            ...customColumns.map((column) => ({ label: column.label, dataType: "text", required: false })),
          ],
          items: rows.map((row) => ({
            name: row.name,
            unit: row.unit,
            quantity: row.quantity,
            reorderLevel: row.reorderLevel,
            customAttributes: {
              [columnLabels.category]: row.category,
              ...Object.fromEntries(customColumns.map((column) => [column.label, row.customFields[column.id] ?? ""])),
            },
          })),
        }),
      });
      const result = await response.json() as { id?: string; error?: string };
      if (!response.ok || !result.id) throw new Error(result.error || "Unable to save this inventory.");
      router.push(`/inventory/${result.id}`);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save this inventory.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={`${poppins.className} app-shell`}>
      <div className="app-body">
        <aside className="sidebar">
          <div className="sidebar-brand"><Image src={logo} alt="AIMS logo" width={48} height={48} className="object-contain" /><p className="sidebar-brand-name">AIMS</p></div>
          <nav className="sidebar-nav" aria-label="Main navigation">
            {navItems.map((item) => { const Icon = item.icon; const active = item.href === "/inventory_creator"; return <Link key={item.href} href={item.href} className={`sidebar-link${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined}><Icon size={16} strokeWidth={1.75} />{item.label}</Link>; })}
          </nav>
          <div className="sidebar-footer"><div className="sidebar-user"><div className="sidebar-avatar">JD</div><div className="min-w-0"><p className="sidebar-user-name">John Doe</p><p className="sidebar-user-role">Administrator</p></div></div><button className="sidebar-logout" type="button"><LogOut size={14} strokeWidth={1.75} />Log out</button></div>
        </aside>

        <section className="main">
          <header className="topbar"><div><h1 className="topbar-title">Manual Inventory Setup</h1><p className="topbar-subtitle">Create one inventory and add its items</p></div><button type="button" className="topbar-icon-btn" title="Notifications" aria-label="Notifications"><Bell size={16} strokeWidth={1.75} /></button></header>
          <div className="page-content">
            <div className="page-inner">
              <Link href="/inventory_creator" className={styles.backLink}><ArrowLeft size={14} />Choose a creation method</Link>
              <section className={styles.inventoryNameCard}>
                <div className={styles.sectionIcon}><PackagePlus size={18} /></div>
                <div className={styles.inventoryNameField}><label htmlFor="inventory-name">Inventory name <span>*</span></label><input id="inventory-name" required value={inventoryName} onChange={(event) => setInventoryName(event.target.value)} placeholder="e.g. Emergency Relief Supplies" maxLength={120} /><small>All items in the table below will belong to this inventory.</small></div>
              </section>

              <form onSubmit={handleAddItem} className={styles.entryCard}>
                <div className={styles.cardHeading}><div><h2>Add an item</h2><p>Type into the fields or edit items directly in the table.</p></div><span className={styles.keyboardHint}><SquarePen size={13} />Live table preview</span></div>
                <div className={styles.entryGrid}>
                  <label>Item name <input required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Family pack" /></label>
                  <label>Category <input required value={category} onChange={(event) => setCategory(event.target.value)} placeholder="e.g. Food supplies" /></label>
                  <label>Quantity <input required type="number" min="0" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="0" /></label>
                  <label>Unit <input required value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="e.g. packs" /></label>
                  <label>Reorder level <input type="number" min="0" step="1" value={reorderLevel} onChange={(event) => setReorderLevel(event.target.value)} placeholder="Optional" /></label>
                  <button className={styles.addButton} type="submit" disabled={!draftReady}><Plus size={15} />Add item to table</button>
                </div>
              </form>

              <section className={styles.tableCard} aria-labelledby="items-table-title">
                <div className={styles.tableHeading}>
                  <div><p className={styles.eyebrow}>Single inventory</p><h2 id="items-table-title">{inventoryName.trim() || "Your inventory items"}</h2><p className={styles.columnHint}>Edit column names here, or add fields for this inventory.</p></div>
                  <div className={styles.tableTools}><span className={styles.rowCount}>{rows.length} {rows.length === 1 ? "item" : "items"}</span><form className={styles.addColumnForm} onSubmit={addColumn}><input value={newColumnName} onChange={(event) => setNewColumnName(event.target.value)} placeholder="New column name" aria-label="New column name" /><button type="submit" disabled={!newColumnName.trim()}><Plus size={13} />Add column</button></form></div>
                </div>
                <div className={styles.tableWrap}>
                  <table className={styles.sheet}>
                    <thead><tr>
                      {(["name", "category", "quantity", "unit", "reorderLevel"] as const).map((key) => <th key={key}><input className={styles.headerInput} aria-label={`Rename ${columnLabels[key]} column`} value={columnLabels[key]} onChange={(event) => setColumnLabels((current) => ({ ...current, [key]: event.target.value }))} /></th>)}
                      {customColumns.map((column) => <th key={column.id}><div className={styles.customHeader}><input className={styles.headerInput} aria-label={`Rename ${column.label} column`} value={column.label} onChange={(event) => setCustomColumns((current) => current.map((entry) => entry.id === column.id ? { ...entry, label: event.target.value } : entry))} /><button type="button" onClick={() => removeColumn(column.id)} aria-label={`Remove ${column.label} column`} title="Remove column"><Trash2 size={12} /></button></div></th>)}
                      {(["status", "updated"] as const).map((key) => <th key={key}><input className={styles.headerInput} aria-label={`Rename ${columnLabels[key]} column`} value={columnLabels[key]} onChange={(event) => setColumnLabels((current) => ({ ...current, [key]: event.target.value }))} /></th>)}
                      <th><span className={styles.srOnly}>Actions</span></th>
                    </tr></thead>
                    <tbody>
                      {draftVisible && <tr className={styles.draftRow}>
                        <td><input aria-label="Preview item name" value={name} onChange={(event) => setName(event.target.value)} placeholder="New item name" /></td>
                        <td><input aria-label="Preview category" value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Category" /></td>
                        <td><input aria-label="Preview quantity" type="number" min="0" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="0" /></td>
                        <td><input aria-label="Preview unit" value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="Unit" /></td>
                        <td><input aria-label="Preview reorder level" type="number" min="0" value={reorderLevel} onChange={(event) => setReorderLevel(event.target.value)} placeholder="0" /></td>
                        {customColumns.map((column) => <td key={column.id}><input aria-label={`Preview ${column.label}`} value={draftCustomFields[column.id] ?? ""} onChange={(event) => setDraftCustomFields((current) => ({ ...current, [column.id]: event.target.value }))} placeholder={column.label} /></td>)}
                        <td><span className={styles.draftBadge}>Draft</span></td><td><span className={styles.draftText}>Updating live</span></td>
                        <td><button type="button" className={styles.iconButton} onClick={() => { setName(""); setCategory(""); setQuantity(""); setUnit(""); setReorderLevel(""); setDraftCustomFields({}); }} aria-label="Clear draft"><Trash2 size={14} /></button></td>
                      </tr>}
                      {rows.length === 0 && !draftVisible ? <tr><td colSpan={8 + customColumns.length} className={styles.emptyState}><PackagePlus size={20} /><strong>No items added yet</strong><span>Start typing above and a preview row will appear here.</span></td></tr> : rows.map((row) => {
                        const status = stockStatus(row);
                        return <tr key={row.id}>
                          <td><input aria-label={`Item name for ${row.name}`} value={row.name} onChange={(event) => updateRow(row.id, "name", event.target.value)} /></td>
                          <td><input aria-label={`Category for ${row.name}`} value={row.category} onChange={(event) => updateRow(row.id, "category", event.target.value)} /></td>
                          <td><input aria-label={`Quantity for ${row.name}`} type="number" min="0" value={row.quantity} onChange={(event) => updateRow(row.id, "quantity", event.target.value)} /></td>
                          <td><input aria-label={`Unit for ${row.name}`} value={row.unit} onChange={(event) => updateRow(row.id, "unit", event.target.value)} /></td>
                          <td><input aria-label={`Reorder level for ${row.name}`} type="number" min="0" value={row.reorderLevel} onChange={(event) => updateRow(row.id, "reorderLevel", event.target.value)} /></td>
                          {customColumns.map((column) => <td key={column.id}><input aria-label={`${column.label} for ${row.name}`} value={row.customFields[column.id] ?? ""} onChange={(event) => updateCustomField(row.id, column.id, event.target.value)} placeholder={column.label} /></td>)}
                          <td><span className={`${styles.statusBadge} ${status.className}`}>{status.label}</span></td><td className={styles.dateCell}>{row.updated}</td>
                          <td><button type="button" className={styles.iconButton} onClick={() => setRows((current) => current.filter((entry) => entry.id !== row.id))} aria-label={`Delete ${row.name}`} title="Delete item"><Trash2 size={14} /></button></td>
                        </tr>;
                      })}
                    </tbody>
                  </table>
                </div>
                <div className={styles.tableFoot}><span><Check size={13} />Edits in the table update immediately.</span><span>Changes stay local until you save this inventory.</span></div>
              </section>
              <div className={styles.saveBar}>
                {saveError && <p role="alert" className={styles.saveError}>{saveError}</p>}
                <button type="button" className={styles.saveButton} disabled={saving || !inventoryName.trim()} onClick={saveInventory}>
                  {saving ? "Saving inventory…" : "Save inventory to database"}<ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
