"use client";

import { useEffect, useState, type ClipboardEvent, type DragEvent, type FormEvent, type KeyboardEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Poppins } from "next/font/google";
import {
  ArrowLeft, ArrowRight, Boxes, Bell, Check, Home, LogOut, PackagePlus, Plus,
  FileBarChart, ClipboardList, GripVertical, Sparkles, TrendingUp, Trash2,
} from "lucide-react";
import styles from "./manual.module.css";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/reports", label: "Inventory Reports", icon: FileBarChart },
  { href: "/replenishment", label: "Replenishment", icon: ClipboardList },
  { href: "/inventory_creator", label: "Inventory Creator", icon: Sparkles },
  { href: "/prediction", label: "Demand Prediction", icon: TrendingUp },
];

type InventoryRow = {
  id: string;
  name: string;
  code: string;
  description: string;
  category: string;
  quantity: number;
  unit: string;
  reorderLevel: number;
  updated: string;
  customFields: Record<string, string>;
};

type ColumnLabels = Record<"name" | "code" | "description" | "category" | "quantity" | "unit" | "reorderLevel" | "status" | "updated", string>;
type CoreColumnKey = keyof ColumnLabels;
type ColumnKey = CoreColumnKey | `custom:${string}`;
type CustomDataType = "text" | "integer" | "decimal" | "date" | "datetime" | "boolean" | "enum";
type CustomColumn = { id: string; label: string; dataType: CustomDataType; options: string; required?: boolean };
type ManualDraftSnapshot = {
  version: 1 | 2; inventoryName: string; rows: InventoryRow[]; columnLabels: ColumnLabels; columnOrder?: ColumnKey[];
  customColumns: CustomColumn[]; newColumnName: string; draftCustomFields?: Record<string, string>;
  name?: string; code?: string; description?: string; category?: string; quantity?: string; unit?: string; reorderLevel?: string;
};
const manualDraftStorageKey = "aims:manual-inventory-draft:v1";
const defaultColumnLabels: ColumnLabels = {
  name: "Item name", code: "Item code", description: "Description", category: "Category", quantity: "Quantity", unit: "Unit",
  reorderLevel: "Reorder level", status: "Status", updated: "Last update",
};
const defaultColumnOrder: ColumnKey[] = ["name", "code", "description", "category", "quantity", "unit", "status", "updated"];
const requiredColumnKeys = new Set<CoreColumnKey>(["name", "quantity", "unit"]);

function parseChoiceOptions(value: string) {
  return value.split(",").map((option) => option.trim()).filter(Boolean);
}

function renderCustomValueEditor(
  column: CustomColumn,
  value: string,
  onChange: (nextValue: string) => void,
  ariaLabel: string,
  gridRow?: string,
  gridField?: string,
) {
  const gridAttributes = { "data-grid-row": gridRow, "data-grid-field": gridField };
  if (column.dataType === "boolean") {
    return <select {...gridAttributes} aria-label={ariaLabel} value={value} onChange={(event) => onChange(event.target.value)}><option value="">Choose…</option><option value="true">Yes</option><option value="false">No</option></select>;
  }
  if (column.dataType === "enum") {
    return <select {...gridAttributes} aria-label={ariaLabel} value={value} onChange={(event) => onChange(event.target.value)}><option value="">Choose…</option>{parseChoiceOptions(column.options).map((option, index) => <option key={`${index}-${option}`} value={option}>{option}</option>)}</select>;
  }
  const inputType = column.dataType === "date" ? "date"
    : column.dataType === "datetime" ? "datetime-local"
      : column.dataType === "integer" || column.dataType === "decimal" ? "number" : "text";
  return <input {...gridAttributes} aria-label={ariaLabel} type={inputType} step={column.dataType === "decimal" ? "0.001" : column.dataType === "integer" ? "1" : undefined} value={value} onChange={(event) => onChange(event.target.value)} placeholder={column.label} />;
}

function currentDate() {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date());
}

function stockStatus(row: Pick<InventoryRow, "quantity" | "reorderLevel">) {
  if (!Number.isFinite(row.quantity)) return { label: "Check quantity", className: styles.statusLow };
  const reorderLevel = Number.isFinite(row.reorderLevel) ? row.reorderLevel : 0;
  if (row.quantity <= 0) return { label: "Out of stock", className: styles.statusOut };
  if (row.quantity <= reorderLevel) return { label: "Low stock", className: styles.statusLow };
  return { label: "In stock", className: styles.statusIn };
}

export default function ManualInventoryPage({ inventoryId }: { inventoryId?: string } = {}) {
  const router = useRouter();
  const [inventoryName, setInventoryName] = useState("");
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [columnLabels, setColumnLabels] = useState<ColumnLabels>(defaultColumnLabels);
  const [columnOrder, setColumnOrder] = useState<ColumnKey[]>(defaultColumnOrder);
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
  const [newColumnName, setNewColumnName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftStatus, setDraftStatus] = useState("Checking this device for a saved draft…");
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const [draggedColumn, setDraggedColumn] = useState<ColumnKey | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnKey | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (inventoryId) {
        void fetch(`/api/inventories/${encodeURIComponent(inventoryId)}`, { cache: "no-store" })
          .then(async (response) => {
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Could not load this inventory.");
            const inventory = result.inventory as { name: string; displayLabels: Record<string, unknown> };
            const fields = result.fields as Array<{ id: string; key: string; label: string; dataType: CustomDataType; required: boolean; options: string[] }>;
            const items = result.items as Array<{ id: string; code: string | null; name: string; description: string | null; unit: string; quantity: number; reorderLevel: number; customAttributes: Record<string, unknown>; updatedAt: string }>;
            const labels = { ...defaultColumnLabels };
            for (const key of Object.keys(labels) as CoreColumnKey[]) {
              const label = inventory.displayLabels[key];
              if (typeof label === "string" && label) labels[key] = label;
            }
            const mappedColumns: CustomColumn[] = fields.filter((field) => field.label.toLocaleLowerCase() !== labels.category.toLocaleLowerCase())
              .map((field) => ({ id: field.id, label: field.label, dataType: field.dataType, options: field.options.join(", "), required: field.required }));
            const categoryField = fields.find((field) => field.label.toLocaleLowerCase() === labels.category.toLocaleLowerCase());
            const mappedRows: InventoryRow[] = items.map((item) => ({
              id: item.id, name: item.name, code: item.code ?? "", description: item.description ?? "", category: categoryField ? String(item.customAttributes[categoryField.key] ?? "") : "",
              quantity: item.quantity, unit: item.unit, reorderLevel: item.reorderLevel, updated: currentDate(),
              customFields: Object.fromEntries(mappedColumns.map((column) => {
                const field = fields.find((entry) => entry.id === column.id);
                return [column.id, String(field ? item.customAttributes[field.key] ?? "" : "")];
              })),
            }));
            const fieldKeyToColumn = new Map(fields.map((field) => [field.label, field.label.toLocaleLowerCase() === labels.category.toLocaleLowerCase() ? "category" : `custom:${field.id}`]));
            const storedOrder = inventory.displayLabels.columnOrder;
            const mappedOrder: ColumnKey[] = Array.isArray(storedOrder) ? storedOrder.flatMap((key): ColumnKey[] => {
              if (typeof key !== "string") return [];
              if (key.startsWith("field:")) {
                const value = fieldKeyToColumn.get(key.slice(6));
                return value ? [value as ColumnKey] : [];
              }
              return (Object.keys(defaultColumnLabels) as CoreColumnKey[]).includes(key as CoreColumnKey) ? [key as ColumnKey] : [];
            }) : defaultColumnOrder;
            setInventoryName(inventory.name);
            setRows(mappedRows);
            setColumnLabels(labels);
            setCustomColumns(mappedColumns);
            setColumnOrder([...new Set([...mappedOrder, ...requiredColumnKeys])]);
            setDraftStatus("Editing the saved inventory.");
            setDraftLoaded(true);
          })
          .catch((error: unknown) => { setSaveError(error instanceof Error ? error.message : "Could not load this inventory."); setDraftLoaded(true); });
        return;
      }
      try {
        const stored = localStorage.getItem(manualDraftStorageKey);
        if (stored) {
          const parsed = JSON.parse(stored) as Partial<ManualDraftSnapshot>;
          if (parsed.version === 1 || parsed.version === 2) {
            if (typeof parsed.inventoryName === "string") setInventoryName(parsed.inventoryName);
            const restoredRows = Array.isArray(parsed.rows) ? parsed.rows as InventoryRow[] : [];
            if (parsed.version === 1 && [parsed.name, parsed.code, parsed.description, parsed.category, parsed.quantity, parsed.unit, parsed.reorderLevel].some((value) => typeof value === "string" && value !== "")) {
              restoredRows.unshift({
                id: `manual-restored-${Date.now()}`,
                name: typeof parsed.name === "string" ? parsed.name : "",
                code: typeof parsed.code === "string" ? parsed.code : "",
                description: typeof parsed.description === "string" ? parsed.description : "",
                category: typeof parsed.category === "string" ? parsed.category : "",
                quantity: typeof parsed.quantity === "string" && parsed.quantity !== "" ? Number(parsed.quantity) : Number.NaN,
                unit: typeof parsed.unit === "string" ? parsed.unit : "",
                reorderLevel: typeof parsed.reorderLevel === "string" && parsed.reorderLevel !== "" ? Number(parsed.reorderLevel) : 0,
                updated: currentDate(),
                customFields: typeof parsed.draftCustomFields === "object" && parsed.draftCustomFields ? parsed.draftCustomFields as Record<string, string> : {},
              });
            }
            setRows(restoredRows);
            if (parsed.columnLabels && typeof parsed.columnLabels === "object") {
              const labels = parsed.columnLabels as Partial<ColumnLabels>;
              setColumnLabels((current) => Object.fromEntries(Object.entries(current).map(([key, fallback]) => [
                key, typeof labels[key as keyof ColumnLabels] === "string" ? labels[key as keyof ColumnLabels] : fallback,
              ])) as ColumnLabels);
            }
            const supportedTypes = new Set<CustomDataType>(["text", "integer", "decimal", "date", "datetime", "boolean", "enum"]);
            const restoredCustomColumns = Array.isArray(parsed.customColumns)
              ? parsed.customColumns.filter((column): column is CustomColumn =>
                Boolean(column && typeof column.id === "string" && typeof column.label === "string"
                  && supportedTypes.has(column.dataType) && typeof column.options === "string"))
              : [];
            setCustomColumns(restoredCustomColumns);
            if (typeof parsed.newColumnName === "string") setNewColumnName(parsed.newColumnName);
            const availableKeys = new Set<ColumnKey>([
              ...Object.keys(defaultColumnLabels) as CoreColumnKey[],
              ...restoredCustomColumns.map((column) => `custom:${column.id}` as const),
            ]);
            const restoredOrder = parsed.version === 2 && Array.isArray(parsed.columnOrder)
              ? parsed.columnOrder.filter((key): key is ColumnKey => typeof key === "string" && availableKeys.has(key as ColumnKey))
              : [...defaultColumnOrder, ...restoredCustomColumns.map((column) => `custom:${column.id}` as const)];
            setColumnOrder([...new Set([...restoredOrder, ...requiredColumnKeys])]);
            setHasRestoredDraft(true);
            setDraftStatus("Restored your saved draft from this device.");
          } else {
            setDraftStatus("No saved draft found.");
          }
        } else {
          setDraftStatus("Drafts are saved automatically on this device.");
        }
      } catch {
        setDraftStatus("Could not read the saved draft from this device.");
      } finally {
        setDraftLoaded(true);
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [inventoryId]);

  useEffect(() => {
    if (!draftLoaded) return;
    if (inventoryId) return;
    const hasDraftContent = Boolean(inventoryName || rows.length || customColumns.length || newColumnName
      || columnOrder.join("|") !== defaultColumnOrder.join("|")
      || Object.entries(columnLabels).some(([key, label]) => label !== defaultColumnLabels[key as CoreColumnKey]));
    if (!hasDraftContent) {
      try { localStorage.removeItem(manualDraftStorageKey); } catch { /* Local storage may be unavailable in this browser. */ }
      return;
    }
    const snapshot: ManualDraftSnapshot = {
      version: 2, inventoryName, rows, columnLabels, columnOrder, customColumns, newColumnName,
    };
    const timeout = window.setTimeout(() => {
      try {
        localStorage.setItem(manualDraftStorageKey, JSON.stringify(snapshot));
        setHasRestoredDraft(true);
        setDraftStatus("Draft saved on this device.");
      } catch {
        setDraftStatus("Could not save the draft on this device.");
      }
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [draftLoaded, inventoryId, inventoryName, rows, columnLabels, columnOrder, customColumns, newColumnName]);

  function discardDraft() {
    if (!window.confirm("Discard the saved manual inventory draft on this device?")) return;
    try { localStorage.removeItem(manualDraftStorageKey); } catch { /* Local storage may be unavailable in this browser. */ }
    setInventoryName("");
    setRows([]);
    setColumnLabels(defaultColumnLabels);
    setColumnOrder(defaultColumnOrder);
    setCustomColumns([]);
    setNewColumnName("");
    setHasRestoredDraft(false);
    setDraftStatus("Draft discarded.");
  }

  function addItemRow() {
    setRows((current) => [...current, {
      id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: "",
      code: "",
      description: "",
      category: "",
      quantity: Number.NaN,
      unit: "",
      reorderLevel: 0,
      updated: currentDate(),
      customFields: Object.fromEntries(customColumns.map((column) => [column.id, ""])),
    }]);
  }

  function updateRow(id: string, field: keyof Omit<InventoryRow, "id" | "updated">, value: string) {
    setRows((current) => current.map((row) => {
      if (row.id !== id) return row;
      const updated = { ...row, updated: currentDate() };
      if (field === "quantity") updated.quantity = value === "" ? Number.NaN : Number(value);
      else if (field === "reorderLevel") updated.reorderLevel = value === "" ? Number.NaN : Number(value);
      else if (field === "name") updated.name = value;
      else if (field === "code") updated.code = value;
      else if (field === "description") updated.description = value;
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
    setCustomColumns((current) => [...current, { id, label, dataType: "text", options: "" }]);
    setColumnOrder((current) => [...current, `custom:${id}`]);
    setRows((current) => current.map((row) => ({ ...row, customFields: { ...row.customFields, [id]: "" } })));
    setNewColumnName("");
  }

  function removeColumn(key: ColumnKey) {
    if (!key.startsWith("custom:") && requiredColumnKeys.has(key as CoreColumnKey)) return;
    setColumnOrder((current) => current.filter((columnKey) => columnKey !== key));
    if (key.startsWith("custom:")) {
      const id = key.slice("custom:".length);
      setCustomColumns((current) => current.filter((column) => column.id !== id));
      setRows((current) => current.map((row) => {
        const customFields = { ...row.customFields };
        delete customFields[id];
        return { ...row, customFields };
      }));
    }
  }

  function moveColumn(source: ColumnKey, destination: ColumnKey) {
    if (source === destination) return;
    setColumnOrder((current) => {
      const from = current.indexOf(source);
      const to = current.indexOf(destination);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      next.splice(from, 1);
      next.splice(from < to ? to - 1 : to, 0, source);
      return next;
    });
  }

  function startColumnDrag(event: DragEvent<HTMLButtonElement>, key: ColumnKey) {
    setDraggedColumn(key);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", key);
  }

  function dropColumn(event: DragEvent<HTMLTableCellElement>, destination: ColumnKey) {
    event.preventDefault();
    const source = event.dataTransfer.getData("text/plain") as ColumnKey || draggedColumn;
    if (source) moveColumn(source, destination);
    setDraggedColumn(null);
    setDragOverColumn(null);
  }

  function getColumnLabel(key: ColumnKey) {
    if (key.startsWith("custom:")) return customColumns.find((column) => column.id === key.slice("custom:".length))?.label ?? "Custom field";
    return columnLabels[key as CoreColumnKey];
  }

  function updateCustomField(rowId: string, columnId: string, value: string) {
    setRows((current) => current.map((row) => row.id === rowId
      ? { ...row, customFields: { ...row.customFields, [columnId]: value }, updated: currentDate() }
      : row));
  }

  function updateGridCell(rowId: string, field: string, value: string) {
    if (field.startsWith("custom:")) updateCustomField(rowId, field.slice(7), value);
    else updateRow(rowId, field as keyof Omit<InventoryRow, "id" | "updated">, value);
  }

  function handleGridKeyDown(event: KeyboardEvent<HTMLTableElement>) {
    if (!["Enter", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    const target = event.target;
    if (!(target instanceof HTMLElement)
      || (target instanceof HTMLSelectElement && event.key.startsWith("Arrow"))
      || (target instanceof HTMLTextAreaElement && event.key !== "Enter")) return;
    if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && target instanceof HTMLInputElement && ["text", "search", "url", "tel", "password"].includes(target.type)) {
      const start = target.selectionStart;
      const end = target.selectionEnd;
      if (event.key === "ArrowLeft" && start !== null && start > 0) return;
      if (event.key === "ArrowRight" && end !== null && end < target.value.length) return;
    }
    const cell = target.closest("td");
    const row = cell?.parentElement;
    const body = row?.parentElement;
    if (!(cell instanceof HTMLTableCellElement) || !(row instanceof HTMLTableRowElement) || !(body instanceof HTMLTableSectionElement)) return;
    let nextRowIndex = Array.from(body.rows).indexOf(row);
    let nextCellIndex = cell.cellIndex;
    if (event.key === "ArrowLeft") nextCellIndex -= 1;
    if (event.key === "ArrowRight") nextCellIndex += 1;
    if (event.key === "ArrowUp" || event.key === "Enter" && event.shiftKey) nextRowIndex -= 1;
    if (event.key === "ArrowDown" || event.key === "Enter" && !event.shiftKey) nextRowIndex += 1;
    const rowStep = nextRowIndex < Array.from(body.rows).indexOf(row) ? -1 : 1;
    const columnStep = event.key === "ArrowLeft" ? -1 : 1;
    while (nextRowIndex >= 0 && nextRowIndex < body.rows.length) {
      const nextRow = body.rows[nextRowIndex];
      while (nextCellIndex >= 0 && nextCellIndex < nextRow.cells.length) {
        const editor = nextRow.cells[nextCellIndex].querySelector<HTMLElement>("[data-grid-field]");
        if (editor) {
          event.preventDefault();
          editor.focus();
          return;
        }
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") nextCellIndex += columnStep;
        else break;
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") return;
      nextRowIndex += rowStep;
    }
  }

  function handleGridPaste(event: ClipboardEvent<HTMLTableElement>) {
    const pastedText = event.clipboardData.getData("text/plain");
    if (!pastedText.includes("\t") && !pastedText.includes("\n")) return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const cell = target.closest("td");
    const row = cell?.parentElement;
    const body = row?.parentElement;
    if (!(cell instanceof HTMLTableCellElement) || !(row instanceof HTMLTableRowElement) || !(body instanceof HTMLTableSectionElement)) return;
    const lines = pastedText.replace(/\r/g, "").split("\n");
    if (lines.at(-1) === "") lines.pop();
    const matrix = lines.map((line) => line.split("\t"));
    if (matrix.length === 1 && matrix[0].length === 1) return;
    event.preventDefault();
    const startRowIndex = Array.from(body.rows).indexOf(row);
    for (const [rowOffset, values] of matrix.entries()) {
      const targetRow = body.rows[startRowIndex + rowOffset];
      if (!targetRow) break;
      for (const [columnOffset, value] of values.entries()) {
        const targetCell = targetRow.cells[cell.cellIndex + columnOffset];
        const editor = targetCell?.querySelector<HTMLElement>("[data-grid-field]");
        if (!editor?.dataset.gridRow || !editor.dataset.gridField) continue;
        updateGridCell(editor.dataset.gridRow, editor.dataset.gridField, value);
      }
    }
  }

  async function saveInventory() {
    const trimmedName = inventoryName.trim();
    if (!trimmedName) {
      setSaveError("Enter an inventory name before saving.");
      return;
    }
    if (trimmedName.length > 120) {
      setSaveError("Inventory names can be up to 120 characters.");
      return;
    }

    const allColumnLabels = columnOrder.map((key) => getColumnLabel(key).trim());
    if (allColumnLabels.some((label) => !label)) {
      setSaveError("Every column needs a name. Check the editable table headers.");
      return;
    }
    const seenLabels = new Set<string>();
    for (const label of allColumnLabels) {
      if (label.length > 120) {
        setSaveError(`Column names can be up to 120 characters: "${label.slice(0, 30)}…" is too long.`);
        return;
      }
      const normalizedLabel = label.toLocaleLowerCase();
      if (seenLabels.has(normalizedLabel)) {
        setSaveError(`Column name "${label}" is used more than once. Give each column a unique name.`);
        return;
      }
      seenLabels.add(normalizedLabel);
    }

    for (const column of customColumns) {
      if (column.dataType === "enum") {
        const options = parseChoiceOptions(column.options);
        if (options.length === 0) {
          setSaveError(`Add at least one choice for the "${column.label.trim()}" column.`);
          return;
        }
        if (options.length > 100) {
          setSaveError(`The "${column.label.trim()}" column can have up to 100 choices.`);
          return;
        }
        if (new Set(options.map((option) => option.toLocaleLowerCase())).size !== options.length) {
          setSaveError(`Choices for "${column.label.trim()}" must be unique.`);
          return;
        }
        if (options.some((option) => option.length > 500)) {
          setSaveError(`Choices for "${column.label.trim()}" can be up to 500 characters each.`);
          return;
        }
      }
    }

    if (rows.length > 1000) {
      setSaveError("An inventory can contain up to 1,000 items at a time.");
      return;
    }
    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 1;
      if (!row.name.trim()) {
        setSaveError(`Item ${rowNumber} needs a name.`);
        return;
      }
      if (row.name.trim().length > 180) {
        setSaveError(`The name for item ${rowNumber} can be up to 180 characters.`);
        return;
      }
      if (row.code.trim().length > 80) {
        setSaveError(`The item code for item ${rowNumber} can be up to 80 characters.`);
        return;
      }
      if (row.description.length > 5000) {
        setSaveError(`The description for item ${rowNumber} can be up to 5,000 characters.`);
        return;
      }
      if (columnOrder.includes("category") && !row.category.trim()) {
        setSaveError(`Item ${rowNumber} needs a value for "${columnLabels.category.trim()}".`);
        return;
      }
      if (!row.unit.trim()) {
        setSaveError(`Item ${rowNumber} needs a unit.`);
        return;
      }
      if (row.unit.trim().length > 40) {
        setSaveError(`The unit for item ${rowNumber} can be up to 40 characters.`);
        return;
      }
      for (const [label, value] of [[columnLabels.quantity, row.quantity], [columnLabels.reorderLevel, Number.isFinite(row.reorderLevel) ? row.reorderLevel : 0]] as const) {
        if (!Number.isFinite(value) || value < 0) {
          setSaveError(`Item ${rowNumber} needs a valid non-negative ${label.trim().toLocaleLowerCase()}.`);
          return;
        }
        if (value > 99999999999.999 || Math.abs(value * 1000 - Math.round(value * 1000)) > 1e-7) {
          setSaveError(`${label} for item ${rowNumber} must fit the database limit of 11 whole digits and 3 decimal places.`);
          return;
        }
      }
      for (const column of customColumns) {
        const value = row.customFields[column.id] ?? "";
        if (column.required && !value.trim()) {
          setSaveError(`Item ${rowNumber} needs a value for "${column.label.trim()}".`);
          return;
        }
        if (!value.trim()) continue;
        const valid = column.dataType === "text" || column.dataType === "enum"
          ? column.dataType === "text" || parseChoiceOptions(column.options).includes(value)
          : column.dataType === "integer" ? Number.isInteger(Number(value))
            : column.dataType === "decimal" ? Number.isFinite(Number(value))
              : column.dataType === "boolean" ? value === "true" || value === "false"
                : column.dataType === "date" ? /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
                  : column.dataType === "datetime" ? !Number.isNaN(Date.parse(value)) : true;
        if (!valid) {
          setSaveError(`The "${column.label.trim()}" value for item ${rowNumber} is not a valid ${column.dataType} value.`);
          return;
        }
      }
    }

    setSaving(true);
    setSaveError("");
    try {
      const response = await fetch(inventoryId ? `/api/inventories/${encodeURIComponent(inventoryId)}` : "/api/inventories", {
        method: inventoryId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          ...(inventoryId ? {} : { description: `Inventory created manually: ${trimmedName}` }),
          displayLabels: {
            ...columnLabels,
            columnOrder: columnOrder.map((key) => key.startsWith("custom:")
              ? `field:${customColumns.find((column) => column.id === key.slice("custom:".length))?.label.trim() ?? ""}`
              : key === "category" ? `field:${columnLabels.category.trim()}` : key),
          },
          generationMethod: "manual",
          fields: columnOrder.flatMap((key) => {
            if (key === "category") return [{ label: columnLabels.category.trim(), dataType: "text", required: true }];
            if (!key.startsWith("custom:")) return [];
            const column = customColumns.find((entry) => entry.id === key.slice("custom:".length));
            return column ? [{ label: column.label.trim(), dataType: column.dataType, required: column.required ?? false,
              options: column.dataType === "enum" ? parseChoiceOptions(column.options) : [] }] : [];
          }),
          items: rows.map((row) => ({
            id: inventoryId && !row.id.startsWith("manual-") ? row.id : undefined,
            name: row.name,
            itemCode: row.code,
            description: row.description,
            unit: row.unit,
            quantity: row.quantity,
            reorderLevel: Number.isFinite(row.reorderLevel) ? row.reorderLevel : 0,
            customAttributes: Object.fromEntries(columnOrder.flatMap((key) => {
              if (key === "category") return [[columnLabels.category.trim(), row.category]];
              if (!key.startsWith("custom:")) return [];
              const column = customColumns.find((entry) => entry.id === key.slice("custom:".length));
              return column ? [[column.label.trim(), row.customFields[column.id] ?? ""]] : [];
            })),
          })),
        }),
      });
      const result = await response.json() as { id?: string; error?: string };
      if (!response.ok || (!inventoryId && !result.id)) throw new Error(result.error || "Unable to save this inventory.");
      if (!inventoryId) try { localStorage.removeItem(manualDraftStorageKey); } catch { /* Local storage may be unavailable in this browser. */ }
      setHasRestoredDraft(false);
      router.push(`/inventory/${result.id ?? inventoryId}`);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save this inventory.");
    } finally {
      setSaving(false);
    }
  }

  function renderColumnHeader(key: ColumnKey) {
    const label = getColumnLabel(key);
    const customColumn = key.startsWith("custom:")
      ? customColumns.find((column) => column.id === key.slice("custom:".length))
      : undefined;
    const required = !key.startsWith("custom:") && requiredColumnKeys.has(key as CoreColumnKey);
    return (
      <th key={key} className={dragOverColumn === key ? styles.dragTarget : undefined}
        onDragOver={(event) => { event.preventDefault(); setDragOverColumn(key); event.dataTransfer.dropEffect = "move"; }}
        onDragLeave={() => setDragOverColumn((current) => current === key ? null : current)}
        onDrop={(event) => dropColumn(event, key)}>
        <div className={styles.columnHeader}>
          <button type="button" className={styles.dragHandle} draggable aria-label={`Move ${label} column`}
            title="Drag to reorder column" onDragStart={(event) => startColumnDrag(event, key)}
            onDragEnd={() => { setDraggedColumn(null); setDragOverColumn(null); }}>
            <GripVertical size={14} />
          </button>
          {customColumn ? <>
            <input className={styles.headerInput} aria-label={`Rename ${label} column`} value={customColumn.label}
              onChange={(event) => setCustomColumns((current) => current.map((entry) => entry.id === customColumn.id ? { ...entry, label: event.target.value } : entry))} />
            <div className={styles.customFieldControls}>
              <select aria-label={`Data type for ${customColumn.label}`} value={customColumn.dataType}
                onChange={(event) => setCustomColumns((current) => current.map((entry) => entry.id === customColumn.id ? { ...entry, dataType: event.target.value as CustomDataType } : entry))}>
                <option value="text">Text</option><option value="integer">Whole number</option><option value="decimal">Decimal</option><option value="date">Date</option><option value="datetime">Date and time</option><option value="boolean">Yes / no</option><option value="enum">Choice list</option>
              </select>
              {customColumn.dataType === "enum" && <input className={styles.choiceOptions} aria-label={`Choices for ${customColumn.label}`} value={customColumn.options}
                onChange={(event) => setCustomColumns((current) => current.map((entry) => entry.id === customColumn.id ? { ...entry, options: event.target.value } : entry))} placeholder="Choices, separated by commas" />}
            </div>
          </> : <input className={styles.headerInput} aria-label={`Rename ${label} column`} value={columnLabels[key as CoreColumnKey]}
            onChange={(event) => setColumnLabels((current) => ({ ...current, [key]: event.target.value }))} />}
          {!required && <button type="button" className={styles.removeColumnButton} onClick={() => removeColumn(key)}
            aria-label={`Remove ${label} column`} title={`Remove ${label} column`}><Trash2 size={13} /></button>}
          {required && <span className={styles.requiredColumnMark} title="Required item field">Required</span>}
        </div>
      </th>
    );
  }

  function renderColumnCell(row: InventoryRow, key: ColumnKey) {
    if (key.startsWith("custom:")) {
      const column = customColumns.find((entry) => entry.id === key.slice("custom:".length));
      if (!column) return <td key={key} />;
      return <td key={key}>{renderCustomValueEditor(column, row.customFields[column.id] ?? "",
        (value) => updateCustomField(row.id, column.id, value), `${column.label} for ${row.name || "new item"}`, row.id, key)}</td>;
    }
    const field = key as CoreColumnKey;
    const ariaLabel = `${columnLabels[field]} for ${row.name || "new item"}`;
    if (field === "status") {
      const status = stockStatus(row);
      return <td key={key}><span className={`${styles.statusBadge} ${status.className}`}>{status.label}</span></td>;
    }
    if (field === "updated") return <td key={key} className={styles.dateCell}>{row.updated}</td>;
    const inputType = field === "quantity" || field === "reorderLevel" ? "number" : "text";
    const value = field === "quantity" || field === "reorderLevel"
      ? Number.isFinite(row[field]) ? row[field] : ""
      : row[field];
    return <td key={key}><input data-grid-row={row.id} data-grid-field={field} aria-label={ariaLabel}
      type={inputType} min={inputType === "number" ? 0 : undefined} step={field === "quantity" || field === "reorderLevel" ? "0.001" : undefined}
      maxLength={field === "name" ? 180 : field === "code" ? 80 : field === "description" ? 5000 : undefined}
      value={value} onChange={(event) => updateRow(row.id, field as keyof Omit<InventoryRow, "id" | "updated">, event.target.value)}
      placeholder={field === "quantity" || field === "reorderLevel" ? "0"
        : field === "name" ? "Item name" : field === "code" ? "Item code"
          : field === "description" ? "Description" : field === "category" ? "Category" : "Unit"} /></td>;
  }

  return (
    <main className={`${poppins.className} app-shell dashboard-theme`}>
      <div className="app-body">
        <aside className="sidebar">
          <div className="sidebar-brand"><Image src="/aims-logo.png" alt="AIMS logo" width={48} height={48} className="object-contain" /><p className="sidebar-brand-name">AIMS</p></div>
          <nav className="sidebar-nav" aria-label="Main navigation">
            {navItems.map((item) => { const Icon = item.icon; const active = inventoryId ? item.href === "/inventory" : item.href === "/inventory_creator"; return <Link key={item.href} href={item.href} className={`sidebar-link${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined}><Icon size={16} strokeWidth={1.75} />{item.label}</Link>; })}
          </nav>
          <div className="sidebar-footer"><div className="sidebar-user"><div className="sidebar-avatar">JD</div><div className="min-w-0"><p className="sidebar-user-name">John Doe</p><p className="sidebar-user-role">Administrator</p></div></div><button className="sidebar-logout" type="button"><LogOut size={14} strokeWidth={1.75} />Log out</button></div>
        </aside>

        <section className="main">
          <header className="topbar"><div><h1 className="topbar-title">{inventoryId ? "Edit inventory" : "Manual Inventory Setup"}</h1><p className="topbar-subtitle">{inventoryId ? "Update this inventory and its items" : "Create one inventory and add its items"}</p></div><button type="button" className="topbar-icon-btn" title="Notifications" aria-label="Notifications"><Bell size={16} strokeWidth={1.75} /></button></header>
          <div className="page-content">
            <div className="page-inner">
              <Link href={inventoryId ? `/inventory/${encodeURIComponent(inventoryId)}` : "/inventory_creator"} className={styles.backLink}><ArrowLeft size={14} />{inventoryId ? "Back to inventory" : "Choose a creation method"}</Link>
              <section className={styles.inventoryNameCard}>
                <div className={styles.sectionIcon}><PackagePlus size={18} /></div>
                <div className={styles.inventoryNameField}><label htmlFor="inventory-name">Inventory name <span>*</span></label><input id="inventory-name" required value={inventoryName} onChange={(event) => setInventoryName(event.target.value)} placeholder="e.g. Emergency Relief Supplies" maxLength={120} /><small>All items in the table below will belong to this inventory.</small></div>
              </section>

              <section className={styles.tableCard} aria-labelledby="items-table-title">
                <div className={styles.tableHeading}>
                  <div><p className={styles.eyebrow}>Single inventory</p><h2 id="items-table-title">{inventoryName.trim() || "Your inventory items"}</h2><p className={styles.columnHint}>Edit items in the table. Drag a column handle to reorder it; remove optional columns with the trash button.</p></div>
                  <div className={styles.tableTools}><span className={styles.rowCount}>{rows.length} {rows.length === 1 ? "item" : "items"}</span>{hasRestoredDraft && <button type="button" className={styles.discardButton} onClick={discardDraft}>Discard draft</button>}<form className={styles.addColumnForm} onSubmit={addColumn}><input value={newColumnName} onChange={(event) => setNewColumnName(event.target.value)} placeholder="New column name" aria-label="New column name" /><button type="submit" disabled={!newColumnName.trim()}><Plus size={13} />Add column</button></form></div>
                </div>
                <div className={styles.tableWrap}>
                  <table className={styles.sheet} onKeyDown={handleGridKeyDown} onPaste={handleGridPaste}>
                    <thead><tr>{columnOrder.map(renderColumnHeader)}
                      <th><span className={styles.srOnly}>Actions</span></th>
                    </tr></thead>
                    <tbody>
                      {rows.length === 0
                        ? <tr><td colSpan={columnOrder.length + 1} className={styles.emptyState}><PackagePlus size={20} /><strong>No items added yet</strong><span>Use the button below the table to add your first item.</span></td></tr>
                        : rows.map((row) => <tr key={row.id}>{columnOrder.map((key) => renderColumnCell(row, key))}
                          <td><button type="button" className={styles.iconButton} onClick={() => setRows((current) => current.filter((entry) => entry.id !== row.id))} aria-label={`Delete ${row.name || "new item"}`} title="Delete item"><Trash2 size={14} /></button></td>
                        </tr>)}
                    </tbody>
                  </table>
                </div>
                <div className={styles.addItemRowBar}>
                  <button type="button" className={styles.addItemButton} onClick={addItemRow}>
                    <Plus size={15} />Add item
                  </button>
                </div>
                <div className={styles.tableFoot}><span><Check size={13} />Edits in the table update immediately.</span><span>{draftStatus} Unsaved work stays on this device until you save this inventory.</span></div>
              </section>
              <div className={styles.saveBar}>
                {saveError && <p role="alert" className={styles.saveError}>{saveError}</p>}
                <button type="button" className={styles.saveButton} disabled={saving || !inventoryName.trim()} onClick={saveInventory}>
                  {saving ? "Saving inventory…" : inventoryId ? "Save inventory changes" : "Save inventory to database"}<ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}





