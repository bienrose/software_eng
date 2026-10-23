"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Poppins } from "next/font/google";
import {
  ArrowRight,
  Boxes,
  Check,
  FileBarChart,
  ClipboardList,
  Home,
  Lightbulb,
  LogOut,
  PackagePlus,
  Sparkles,
  TrendingUp,
  WandSparkles,
} from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import styles from "../inventory-creator.module.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

type DraftField = {
  name: string;
  type: string;
};

type DraftSchema = {
  category: string;
  fields: DraftField[];
  merged: string[];
};

type NlpField = {
  name: string;
  type: string;
  suggested?: boolean;
};

type NlpSchemaResponse = {
  fields?: NlpField[];
  core_matches?: { requested: string; core_field: string }[];
};

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/reports", label: "Inventory Reports", icon: FileBarChart },
  { href: "/replenishment", label: "Replenishment", icon: ClipboardList },
  { href: "/inventory_creator", label: "Inventory Creator", icon: Sparkles },
  { href: "/prediction", label: "Demand Prediction", icon: TrendingUp },
];

const examples = [
  {
    label: "Medical supplies",
    prompt:
      "Create an inventory for medical supplies with item name, quantity, expiration date, batch number, and supplier.",
  },
  {
    label: "Rescue equipment",
    prompt:
      "I need to manage rescue equipment with equipment name, condition, quantity, maintenance date, and status.",
  },
  {
    label: "Food and water",
    prompt:
      "Track food and water supplies with item name, quantity, unit, expiration date, and storage location.",
  },
];

const coreFields = ["Item name", "Item code", "Unit", "Quantity on hand"];

// Words a user might type that mean the same thing as a core field.
const coreAliases: Record<string, string[]> = {
  "Item name": [
    "item name", "name", "item", "product", "product name", "medicine", "medicine name",
    "ingredient", "ingredient name", "material", "material name", "supply", "supply name",
    "item description",
  ],
  "Item code": ["item code", "code", "sku", "product code", "item id", "barcode", "item number", "product id"],
  Unit: ["unit", "uom", "unit of measure", "unit of measurement", "measurement unit"],
  "Quantity on hand": [
    "quantity on hand", "quantity", "qty", "stock", "stock on hand", "on hand", "stock level",
    "current stock", "stock quantity", "available quantity", "quantity available",
    "amount in stock", "count",
  ],
};

const itemNouns =
  "equipment|tool|tools|device|material|supply|supplies|asset|drug|medicine|product|item|ingredient|part|instrument|goods|food|resource";

function singular(value: string) {
  return value.length > 3 && value.endsWith("s") ? value.slice(0, -1) : value;
}

// Returns the core field this name duplicates, or null if it is a genuinely new field.
function matchCoreField(name: string): string | null {
  const value = name.toLowerCase().replace(/\s+/g, " ").trim();
  const candidates = [value, singular(value)];
  for (const [core, aliases] of Object.entries(coreAliases)) {
    if (candidates.some((candidate) => aliases.includes(candidate))) return core;
  }
  // "Equipment Name", "Tool Name", ... are the item name.
  if (new RegExp(`^(${itemNouns})\\s+name$`).test(value)) return "Item name";
  // "Equipment ID", "Asset Code", ... are the item code.
  if (new RegExp(`^(${itemNouns})\\s+(code|id)$`).test(value)) return "Item code";
  return null;
}

function titleCase(value: string) {
  return value
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function inferFieldType(fieldName: string) {
  const value = fieldName.toLowerCase();
  // Identifiers first, so "Batch Number" stays Text instead of Number.
  if (/\b(batch|lot|serial|model|sku|barcode|code|id|reference|ref|invoice|po|phone|contact|mobile|zip|postal|license|licence|registration)\b/.test(value)) return "Text";
  if (/(date|expires|expiration|expiry|maintenance|manufactur)/.test(value)) return "Date";
  if (/(quantity|amount|count|number|stock|level|price|cost|weight)/.test(value)) return "Number";
  if (/(status|condition|type|category)/.test(value)) return "Choice";
  return "Text";
}

function noteMerge(merged: string[], requested: string, core: string) {
  if (requested.toLowerCase() === core.toLowerCase()) return;
  const note = `${requested} → ${core}`;
  if (!merged.includes(note)) merged.push(note);
}

// Built-in parser. Used on its own if the NLP service is not running.
function createDraftSchema(description: string): DraftSchema {
  const categoryMatch = description.match(
    /(?:inventory\s+for|manage|track|create\s+(?:an?\s+)?inventory\s+for)\s+(.+?)(?=\s+(?:with|containing|including|that\s+includes)\b|[.!?]|$)/i,
  );
  const fieldMatch = description.match(
    /(?:with|containing|including|include|fields?\s+(?:such\s+as|like))\s+(.+?)(?:[.!?]|$)/i,
  );

  const category = titleCase(categoryMatch?.[1] ?? "New inventory");
  const merged: string[] = [];
  const fields = (fieldMatch?.[1] ?? "")
    .replace(/\band\b/gi, ",")
    .split(/[;,]/)
    .map((field) => titleCase(field.replace(/^(?:a|an|the)\s+/i, "")))
    .filter(Boolean)
    .filter((field) => {
      const core = matchCoreField(field);
      if (core) noteMerge(merged, field, core);
      return !core;
    });

  return {
    category,
    merged,
    fields: Array.from(new Set(fields)).map((name) => ({
      name,
      type: inferFieldType(name),
    })),
  };
}

function nlpFieldType(nlpType: string, name: string) {
  if (nlpType === "date") return "Date";
  if (nlpType === "number") return "Number";
  return inferFieldType(name) === "Choice" ? "Choice" : "Text";
}

// Combine the NLP service result with the local category name.
function mergeNlpSchema(local: DraftSchema, nlp: NlpSchemaResponse): DraftSchema {
  const merged: string[] = [];
  (nlp.core_matches ?? []).forEach((match) => noteMerge(merged, match.requested, match.core_field));

  const seen = new Set<string>();
  const fields: DraftField[] = [];
  (nlp.fields ?? [])
    .filter((field) => !field.suggested)
    .forEach((field) => {
      const name = titleCase(field.name);
      const key = name.toLowerCase();
      if (!name || seen.has(key)) return;
      seen.add(key);
      const core = matchCoreField(name);
      if (core) {
        noteMerge(merged, name, core);
        return;
      }
      fields.push({ name, type: nlpFieldType(field.type, name) });
    });

  // If the service found nothing, trust the built-in parser instead.
  if (fields.length === 0 && merged.length === 0) return local;
  return { category: local.category, fields, merged };
}

export default function InventoryCreatorPage() {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [draft, setDraft] = useState<DraftSchema | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedDescription = description.trim();

    if (trimmedDescription.length < 12) {
      setError("Add a little more detail so the preview has something to work with.");
      setDraft(null);
      return;
    }

    setError("");
    setPreviewing(true);
    const local = createDraftSchema(trimmedDescription);
    let result = local;
    try {
      const response = await fetch("/api/nlp/infer-schema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmedDescription }),
      });
      if (response.ok) {
        const nlp = (await response.json()) as NlpSchemaResponse;
        result = mergeNlpSchema(local, nlp);
      }
    } catch {
      // NLP service is off: keep the built-in result.
    }
    setDraft(result);
    setPreviewing(false);
  }

  function chooseExample(prompt: string) {
    setDescription(prompt);
    setError("");
    setDraft(null);
  }

  async function saveDraftInventory() {
    if (!draft) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/inventories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.category,
          description: `Created from an adaptive inventory description: ${draft.category}`,
          sourcePrompt: description,
          generationMethod: "nlp",
          fields: draft.fields.map((field) => ({
            label: field.name,
            dataType: field.type === "Date" ? "date" : field.type === "Number" ? "decimal" : field.type === "Choice" ? "enum" : "text",
          })),
        }),
      });
      const result = await response.json() as { id?: string; error?: string };
      if (!response.ok || !result.id) throw new Error(result.error || "Could not create this inventory.");
      router.push(`/inventory/${result.id}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not create this inventory.");
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
              const active = item.href === "/inventory_creator";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sidebar-link${active ? " is-active" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon size={16} strokeWidth={1.75} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="sidebar-footer">
            <div className="sidebar-user">
              <div className="sidebar-avatar">JD</div>
              <div className="min-w-0">
                <p className="sidebar-user-name">John Doe</p>
                <p className="sidebar-user-role">Administrator</p>
              </div>
            </div>
            <button className="sidebar-logout" type="button">
              <LogOut size={14} strokeWidth={1.75} />
              Log out
            </button>
          </div>
        </aside>

        <section className="main">
          <header className="topbar">
            <div>
              <h1 className="topbar-title">Automatic Inventory Setup</h1>
              <p className="topbar-subtitle">Describe what you need to keep track of</p>
            </div>
            <div className={styles.topbarBadge}>
              <Sparkles size={14} />
              <span>Adaptive setup</span>
            </div>
          </header>

          <div className="page-content">
            <div className={`${styles.content} page-inner`}>
              <Link href="/inventory_creator" className={styles.modeBackLink}><ArrowRight size={13} />Choose a creation method</Link>
              <div className={styles.intro}>
                <div className={styles.eyebrow}>
                  <WandSparkles size={15} />
                  <span>Build an inventory around your needs</span>
                </div>
                <h2>What would you like to manage?</h2>
                <p>
                  Describe the items and details you need to track. AIMS can use your
                  requirements to shape an inventory that fits your workflow.
                </p>
              </div>

              <div className={styles.builderGrid}>
                <form className={styles.promptCard} onSubmit={handleSubmit}>
                  <div className={styles.cardHeading}>
                    <div className={styles.headingIcon}>
                      <ClipboardList size={18} />
                    </div>
                    <div>
                      <h3>Describe your inventory</h3>
                      <p>Use plain language. You can refine the details later.</p>
                    </div>
                  </div>

                  <label className={styles.promptLabel} htmlFor="inventory-description">
                    Your description
                  </label>
                  <textarea
                    id="inventory-description"
                    className={styles.promptInput}
                    value={description}
                    onChange={(event) => {
                      setDescription(event.target.value);
                      setError("");
                      setDraft(null);
                    }}
                    maxLength={500}
                    placeholder="Example: Create an inventory for medical supplies with item name, quantity, expiration date, batch number, and supplier."
                    aria-describedby={error ? "prompt-error" : "prompt-help"}
                  />
                  <div className={styles.promptMeta}>
                    {error ? (
                      <span className={styles.errorText} id="prompt-error" role="alert">
                        {error}
                      </span>
                    ) : (
                      <span id="prompt-help">Include the information you want to record for each item.</span>
                    )}
                    <span className={styles.characterCount}>{description.length}/500</span>
                  </div>

                  <div className={styles.examples}>
                    <span className={styles.examplesLabel}>Try an example</span>
                    <div className={styles.exampleList}>
                      {examples.map((example) => (
                        <button
                          className={styles.exampleChip}
                          key={example.label}
                          onClick={() => chooseExample(example.prompt)}
                          type="button"
                        >
                          {example.label}
                          <ArrowRight size={12} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={styles.formFooter}>
                    <span className={styles.localNote}>
                      <Lightbulb size={14} />
                      Review before anything is saved
                    </span>
                    <button className={styles.generateButton} type="submit" disabled={previewing}>
                      <Sparkles size={15} />
                      {previewing ? "Previewing…" : "Preview structure"}
                    </button>
                  </div>
                </form>

                <aside className={styles.guideCard}>
                  <div className={styles.guideHeader}>
                    <div className={styles.guideIcon}>
                      <PackagePlus size={18} />
                    </div>
                    <div>
                      <h3>How it works</h3>
                      <p>From a description to a useful structure</p>
                    </div>
                  </div>

                  <ol className={styles.steps}>
                    <li>
                      <span className={styles.stepNumber}>1</span>
                      <div>
                        <strong>Describe what you track</strong>
                        <p>Name the inventory and the details that matter.</p>
                      </div>
                    </li>
                    <li>
                      <span className={styles.stepNumber}>2</span>
                      <div>
                        <strong>Review the suggested fields</strong>
                        <p>Check the draft before it becomes part of your inventory.</p>
                      </div>
                    </li>
                    <li>
                      <span className={styles.stepNumber}>3</span>
                      <div>
                        <strong>Manage your items</strong>
                        <p>Use the new structure to record stock and transactions.</p>
                      </div>
                    </li>
                  </ol>

                  <div className={styles.coreFields}>
                    <span className={styles.coreFieldsTitle}>Every inventory includes</span>
                    <div className={styles.coreFieldList}>
                      {coreFields.map((field) => (
                        <span className={styles.coreField} key={field}>
                          <Check size={12} />
                          {field}
                        </span>
                      ))}
                    </div>
                  </div>
                </aside>
              </div>

              {draft && (
                <section className={styles.previewCard} aria-live="polite">
                  <div className={styles.previewHeader}>
                    <div className={styles.previewHeading}>
                      <div className={styles.previewIcon}>
                        <Boxes size={18} />
                      </div>
                      <div>
                        <div className={styles.previewTitleLine}>
                          <h3>{draft.category}</h3>
                          <span className={styles.draftBadge}>Draft preview</span>
                        </div>
                        <p>Review the fields suggested by your description</p>
                      </div>
                    </div>
                    <span className={styles.previewCount}>
                      {coreFields.length + draft.fields.length} fields
                    </span>
                  </div>

                  <div className={styles.fieldTableWrap}>
                    <table className={styles.fieldTable}>
                      <thead>
                        <tr>
                          <th>Field</th>
                          <th>Type</th>
                          <th>Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {coreFields.map((field) => (
                          <tr key={field}>
                            <td>
                              <span className={styles.fieldName}>{field}</span>
                            </td>
                            <td>{field === "Quantity on hand" ? "Number" : "Text"}</td>
                            <td><span className={styles.coreBadge}>Core field</span></td>
                          </tr>
                        ))}
                        {draft.fields.map((field) => (
                          <tr key={field.name}>
                            <td><span className={styles.fieldName}>{field.name}</span></td>
                            <td>{field.type}</td>
                            <td><span className={styles.adaptiveBadge}>From your description</span></td>
                          </tr>
                        ))}
                        {draft.fields.length === 0 && (
                          <tr>
                            <td colSpan={3} className={styles.emptyFields}>
                              No extra fields were detected. Add details such as expiration date, condition, or supplier to your description.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {draft.merged.length > 0 && (
                    <div className={styles.previewFootnote}>
                      <Check size={14} />
                      Already covered by core fields: {draft.merged.join(", ")}
                    </div>
                  )}
                  <div className={styles.previewFootnote}>
                    <Lightbulb size={14} />
                    Review this suggested schema before creating the inventory in aims_db.
                  </div>
                  {error && <p className={styles.saveError} role="alert">{error}</p>}
                  <div className={styles.previewActions}><button type="button" onClick={saveDraftInventory} disabled={saving}>{saving ? "Creating inventory…" : "Create inventory in database"}<ArrowRight size={14} /></button></div>
                </section>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

