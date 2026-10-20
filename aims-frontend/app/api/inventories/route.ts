import { randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { databaseErrorResponse, withConnection } from "@/lib/mysql";
import { validateSchemaValue } from "@/lib/schema-value";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FieldInput = { label?: unknown; dataType?: unknown; required?: unknown };
type ItemInput = {
  name?: unknown;
  itemCode?: unknown;
  description?: unknown;
  unit?: unknown;
  quantity?: unknown;
  reorderLevel?: unknown;
  customAttributes?: unknown;
};

const validTypes = new Set(["text", "integer", "decimal", "boolean", "date", "datetime", "enum"]);
const reservedKeys = new Set([
  "id", "category_id", "schema_version_id", "item_code", "name", "description",
  "unit", "quantity_on_hand", "reorder_level", "custom_attributes", "created_at", "updated_at",
]);

function fieldKey(label: string) {
  let key = label.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!key || !/^[a-z]/.test(key)) key = `field_${key || "value"}`;
  key = key.slice(0, 63);
  if (reservedKeys.has(key)) key = `custom_${key}`.slice(0, 63);
  return key;
}

function readAttributes(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function GET() {
  try {
    const inventories = await withConnection(async (connection) => {
      const [rows] = await connection.execute<RowDataPacket[]>(`
        SELECT c.id, c.name, c.description, c.created_at,
          s.id AS schema_version_id, s.version_number,
          (SELECT COUNT(*) FROM inventory_schema_fields f WHERE f.schema_version_id = s.id) AS field_count,
          (SELECT COUNT(*) FROM inventory_items i WHERE i.category_id = c.id AND i.is_active = TRUE) AS item_count,
          (SELECT COALESCE(SUM(i.quantity_on_hand), 0) FROM inventory_items i WHERE i.category_id = c.id AND i.is_active = TRUE) AS total_units,
          (SELECT COUNT(*) FROM inventory_items i WHERE i.category_id = c.id AND i.is_active = TRUE AND i.quantity_on_hand = 0) AS out_of_stock_count,
          (SELECT COUNT(*) FROM inventory_items i WHERE i.category_id = c.id AND i.is_active = TRUE AND i.quantity_on_hand > 0 AND i.quantity_on_hand <= i.reorder_level) AS low_stock_count
        FROM inventory_categories c
        LEFT JOIN inventory_schema_versions s ON s.category_id = c.id AND s.status = 'active'
        WHERE c.archived_at IS NULL
        ORDER BY c.name ASC`);
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        createdAt: row.created_at,
        schemaVersionId: row.schema_version_id,
        schemaVersion: row.version_number,
        fieldCount: Number(row.field_count || 0),
        itemCount: Number(row.item_count || 0),
        totalUnits: Number(row.total_units || 0),
        lowStockCount: Number(row.low_stock_count || 0),
        outOfStockCount: Number(row.out_of_stock_count || 0),
      }));
    });
    return Response.json({ inventories });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}

export async function POST(request: Request) {
  let body: { name?: unknown; description?: unknown; generationMethod?: unknown; sourcePrompt?: unknown; fields?: unknown; items?: unknown; displayLabels?: unknown };
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return Response.json({ error: "Send a JSON object." }, { status: 400 });
    body = parsed as typeof body;
  } catch {
    return Response.json({ error: "Send a valid JSON request body." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 120) return Response.json({ error: "Inventory name is required (up to 120 characters)." }, { status: 400 });
  const method = body.generationMethod === "nlp" || body.generationMethod === "llm" ? body.generationMethod : "manual";
  const fields = Array.isArray(body.fields) ? body.fields as FieldInput[] : [];
  const items = Array.isArray(body.items) ? body.items as ItemInput[] : [];
  if (items.length > 1000) return Response.json({ error: "A single inventory can include at most 1,000 items." }, { status: 400 });

  const normalizedFields: Array<{ key: string; label: string; dataType: string; required: boolean }> = [];
  const usedKeys = new Set<string>();
  const usedLabels = new Set<string>();
  for (const field of fields) {
    const label = typeof field.label === "string" ? field.label.trim() : "";
    if (!label || label.length > 120) continue;
    const normalizedLabel = label.toLocaleLowerCase();
    if (usedLabels.has(normalizedLabel)) return Response.json({ error: `The field name "${label}" is duplicated.` }, { status: 400 });
    usedLabels.add(normalizedLabel);
    const dataType = typeof field.dataType === "string" && validTypes.has(field.dataType) ? field.dataType : "text";
    const baseKey = fieldKey(label);
    let key = baseKey;
    let suffix = 2;
    while (usedKeys.has(key)) {
      const ending = `_${suffix++}`;
      key = `${baseKey.slice(0, 63 - ending.length)}${ending}`;
    }
    usedKeys.add(key);
    normalizedFields.push({ key, label, dataType, required: Boolean(field.required) });
  }

  const inventoryId = randomUUID();
  const schemaId = randomUUID();
  const slugBase = name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 140);
  const slug = slugBase || `inventory-${inventoryId.slice(0, 8)}`;
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 5000) : null;
  const sourcePrompt = typeof body.sourcePrompt === "string" ? body.sourcePrompt.trim().slice(0, 10000) : null;
  const providedLabels = readAttributes(body.displayLabels);
  const defaultLabels = { name: "Item name", category: "Category", quantity: "Quantity", unit: "Unit", reorderLevel: "Reorder level", status: "Status", updated: "Last update" };
  const coreLabelKeys = Object.keys(defaultLabels) as Array<keyof typeof defaultLabels>;
  const displayLabels = Object.fromEntries(coreLabelKeys.map((key) => {
    const value = providedLabels[key];
    return [key, typeof value === "string" && value.trim() ? value.trim().slice(0, 120) : defaultLabels[key]];
  }));

  try {
    await withConnection(async (connection) => {
      await connection.beginTransaction();
      try {
        await connection.execute(
          "INSERT INTO inventory_categories (id, name, slug, description) VALUES (?, ?, ?, ?)",
          [inventoryId, name, slug, description],
        );
        await connection.execute(
          "INSERT INTO inventory_schema_versions (id, category_id, version_number, status, source_prompt, generation_method, display_labels) VALUES (?, ?, 1, 'draft', ?, ?, ?)",
          [schemaId, inventoryId, sourcePrompt, method, JSON.stringify(displayLabels)],
        );

        for (const [index, field] of normalizedFields.entries()) {
          await connection.execute(
            "INSERT INTO inventory_schema_fields (id, schema_version_id, field_key, label, data_type, is_required, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [randomUUID(), schemaId, field.key, field.label, field.dataType, field.required, index],
          );
        }

        await connection.execute(
          "UPDATE inventory_schema_versions SET status = 'active', published_at = CURRENT_TIMESTAMP(3) WHERE id = ?",
          [schemaId],
        );

        for (const item of items) {
          const itemName = typeof item.name === "string" ? item.name.trim() : "";
          const unit = typeof item.unit === "string" ? item.unit.trim() : "";
          const quantity = Number(item.quantity ?? 0);
          const reorderLevel = Number(item.reorderLevel ?? 0);
          if (!itemName || !unit || !Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(reorderLevel) || reorderLevel < 0) {
            throw new Error("Each item needs a name, unit, and non-negative quantity and reorder level.");
          }
          const inputAttributes = readAttributes(item.customAttributes);
          const attributes: Record<string, unknown> = {};
          for (const field of normalizedFields) {
            const supplied = inputAttributes[field.label] ?? inputAttributes[field.key];
            if (field.required && (supplied === undefined || supplied === null || supplied === "")) {
              throw new Error(`Field "${field.label}" is required for every item.`);
            }
            if (supplied === undefined || supplied === "") continue;
            const validated = validateSchemaValue(field.dataType, supplied);
            if (!validated.valid) throw new Error(`Field "${field.label}" has an invalid ${field.dataType} value.`);
            attributes[field.key] = validated.value;
          }
          await connection.execute(
            `INSERT INTO inventory_items
              (id, category_id, schema_version_id, item_code, name, description, unit, quantity_on_hand, reorder_level, custom_attributes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [randomUUID(), inventoryId, schemaId,
              typeof item.itemCode === "string" && item.itemCode.trim() ? item.itemCode.trim().slice(0, 80) : null,
              itemName.slice(0, 180), typeof item.description === "string" ? item.description.trim() : null,
              unit.slice(0, 40), quantity, reorderLevel, JSON.stringify(attributes)],
          );
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    });
    return Response.json({ id: inventoryId, name }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && (error.message.startsWith("Each item needs") || error.message.startsWith("Field "))) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if ((error as { code?: string })?.code === "ER_DUP_ENTRY") {
      return Response.json({ error: "An inventory with this name already exists. Choose a different name." }, { status: 409 });
    }
    return databaseErrorResponse(error);
  }
}
