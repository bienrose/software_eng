import { randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { databaseErrorResponse, withConnection } from "@/lib/mysql";
import { validateSchemaValue } from "@/lib/schema-value";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JsonObject = Record<string, unknown>;
function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value) as unknown; } catch { return null; }
}
function parseObject(value: unknown): JsonObject {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as JsonObject;
  const parsed = parseJson(value);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as JsonObject;
  return {};
}

export async function GET(_request: Request, { params }: { params: Promise<{ inventoryId: string }> }) {
  const { inventoryId } = await params;
  try {
    const result = await withConnection(async (connection) => {
      const [inventoryRows] = await connection.execute<RowDataPacket[]>(
        `SELECT c.id, c.name, c.description, c.created_at, s.id AS schema_version_id, s.version_number, s.display_labels
         FROM inventory_categories c
         LEFT JOIN inventory_schema_versions s ON s.category_id = c.id AND s.status = 'active'
         WHERE c.id = ? AND c.archived_at IS NULL LIMIT 1`,
        [inventoryId],
      );
      if (!inventoryRows.length) return null;
      const inventory = inventoryRows[0];
      if (!inventory.schema_version_id) return { inventory: null, fields: [], items: [], movements: [] };

      const [fieldRows] = await connection.execute<RowDataPacket[]>(
        `SELECT id, field_key, label, data_type, is_required, options, display_order
         FROM inventory_schema_fields WHERE schema_version_id = ? ORDER BY display_order, label`,
        [inventory.schema_version_id],
      );
      const [itemRows] = await connection.execute<RowDataPacket[]>(
        `SELECT id, item_code, name, description, unit, quantity_on_hand, reorder_level,
                custom_attributes, created_at, updated_at
         FROM inventory_items WHERE category_id = ? AND is_active = TRUE ORDER BY name ASC`,
        [inventoryId],
      );
      const [movementRows] = await connection.execute<RowDataPacket[]>(
        `SELECT t.id, t.inventory_item_id, i.name AS item_name, t.movement_type,
                t.quantity, t.balance_after, t.reference, t.notes, t.occurred_at
         FROM inventory_transactions t
         INNER JOIN inventory_items i ON i.id = t.inventory_item_id
         WHERE i.category_id = ? ORDER BY t.occurred_at DESC LIMIT 10`,
        [inventoryId],
      );

      return {
        inventory: {
          id: inventory.id,
          name: inventory.name,
          description: inventory.description,
          createdAt: inventory.created_at,
          schemaVersion: Number(inventory.version_number),
          displayLabels: parseObject(inventory.display_labels),
        },
        fields: fieldRows.map((field) => ({
          id: field.id,
          key: field.field_key,
          label: field.label,
          dataType: field.data_type,
          required: Boolean(field.is_required),
          options: Array.isArray(parseJson(field.options)) ? parseJson(field.options) as unknown[] : [],
          displayOrder: Number(field.display_order),
        })),
        items: itemRows.map((item) => ({
          id: item.id,
          code: item.item_code,
          name: item.name,
          description: item.description,
          unit: item.unit,
          quantity: Number(item.quantity_on_hand),
          reorderLevel: Number(item.reorder_level),
          customAttributes: parseObject(item.custom_attributes),
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        })),
        movements: movementRows.map((movement) => ({
          id: movement.id,
          itemId: movement.inventory_item_id,
          itemName: movement.item_name,
          kind: movement.movement_type,
          quantity: Number(movement.quantity),
          balanceAfter: Number(movement.balance_after),
          reference: movement.reference,
          notes: movement.notes,
          occurredAt: movement.occurred_at,
        })),
      };
    });

    if (!result) return Response.json({ error: "Inventory not found." }, { status: 404 });
    if (!result.inventory) return Response.json({ error: "This inventory has no active schema version." }, { status: 409 });
    return Response.json(result);
  } catch (error) {
    return databaseErrorResponse(error);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ inventoryId: string }> }) {
  const { inventoryId } = await params;
  let body: { name?: unknown; description?: unknown; fields?: unknown; items?: unknown; displayLabels?: unknown };
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return Response.json({ error: "Send a JSON object." }, { status: 400 });
    body = parsed as typeof body;
  } catch { return Response.json({ error: "Send a valid JSON request body." }, { status: 400 }); }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const hasDescription = Object.hasOwn(body, "description");
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 5000) : null;
  const fields = Array.isArray(body.fields) ? body.fields as Array<{ label?: unknown; dataType?: unknown; required?: unknown; options?: unknown }> : [];
  const items = Array.isArray(body.items) ? body.items as Array<{ id?: unknown; name?: unknown; itemCode?: unknown; description?: unknown; unit?: unknown; quantity?: unknown; reorderLevel?: unknown; customAttributes?: unknown }> : [];
  const displayLabels = body.displayLabels && typeof body.displayLabels === "object" && !Array.isArray(body.displayLabels) ? body.displayLabels as Record<string, unknown> : {};
  if (!name || name.length > 120) return Response.json({ error: "Inventory name is required (up to 120 characters)." }, { status: 400 });
  if (items.length > 1000) return Response.json({ error: "An inventory can contain up to 1,000 items." }, { status: 400 });
  const validTypes = new Set(["text", "integer", "decimal", "boolean", "date", "datetime", "enum"]);
  let fieldList: Array<{ label: string; dataType: string; required: boolean; options: string[]; key: string }>;
  try {
    fieldList = fields.map((field, index) => {
      const label = typeof field.label === "string" ? field.label.trim() : "";
      if (!label || label.length > 120 || typeof field.dataType !== "string" || !validTypes.has(field.dataType)) throw new Error(`Field ${index + 1} needs a valid name and data type.`);
      const options = Array.isArray(field.options) ? field.options.filter((option): option is string => typeof option === "string").map((option) => option.trim()).filter(Boolean) : [];
      if (field.dataType === "enum" && options.length === 0) throw new Error(`Add at least one choice for "${label}".`);
      return { label, dataType: field.dataType, required: field.required === true, options, key: label.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^[^a-z]+/, "field_").slice(0, 63) };
    });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Invalid inventory fields." }, { status: 400 }); }
  if (new Set(fieldList.map((field) => field.label.toLocaleLowerCase())).size !== fieldList.length) return Response.json({ error: "Column names must be unique." }, { status: 400 });
  const reserved = new Set(["id", "category_id", "schema_version_id", "item_code", "name", "description", "unit", "quantity_on_hand", "reorder_level", "custom_attributes", "created_at", "updated_at"]);
  const keys = new Set<string>();
  for (const field of fieldList) {
    let key = field.key || "field_value";
    if (reserved.has(key)) key = `custom_${key}`.slice(0, 63);
    const base = key; let suffix = 2;
    while (keys.has(key)) { const tail = `_${suffix++}`; key = `${base.slice(0, 63 - tail.length)}${tail}`; }
    field.key = key; keys.add(key);
  }
  const labels: Record<string, unknown> = { ...displayLabels };
  const columnKeys = new Set(["name", "code", "description", "quantity", "unit", "reorderLevel", "status", "updated", ...fieldList.map((field) => `field:${field.label}`)]);
  labels.columnOrder = Array.isArray(displayLabels.columnOrder) ? [...new Set(displayLabels.columnOrder.filter((key): key is string => typeof key === "string" && columnKeys.has(key)))] : [];

  try {
    await withConnection(async (connection) => {
      await connection.beginTransaction();
      try {
        const [inventoryRows] = await connection.execute<RowDataPacket[]>("SELECT name FROM inventory_categories WHERE id = ? AND archived_at IS NULL FOR UPDATE", [inventoryId]);
        if (!inventoryRows.length) throw new Error("Inventory not found.");
        const [schemaRows] = await connection.execute<RowDataPacket[]>("SELECT id, version_number FROM inventory_schema_versions WHERE category_id = ? AND status = 'active' FOR UPDATE", [inventoryId]);
        if (!schemaRows.length) throw new Error("This inventory has no active schema version.");
        const oldSchemaId = String(schemaRows[0].id);
        const nextVersion = Number(schemaRows[0].version_number) + 1;
        const newSchemaId = randomUUID();
        if (hasDescription) await connection.execute("UPDATE inventory_categories SET name = ?, description = ? WHERE id = ?", [name, description, inventoryId]);
        else await connection.execute("UPDATE inventory_categories SET name = ? WHERE id = ?", [name, inventoryId]);
        await connection.execute("INSERT INTO inventory_schema_versions (id, category_id, version_number, status, generation_method, display_labels) VALUES (?, ?, ?, 'draft', 'manual', ?)", [newSchemaId, inventoryId, nextVersion, JSON.stringify(labels)]);
        for (const [index, field] of fieldList.entries()) await connection.execute(
          "INSERT INTO inventory_schema_fields (id, schema_version_id, field_key, label, data_type, is_required, options, display_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [randomUUID(), newSchemaId, field.key, field.label, field.dataType, field.required, JSON.stringify(field.options), index],
        );
        const [existingRows] = await connection.execute<RowDataPacket[]>("SELECT id, quantity_on_hand FROM inventory_items WHERE category_id = ? AND is_active = TRUE FOR UPDATE", [inventoryId]);
        const knownItems = new Map(existingRows.map((row) => [String(row.id), Number(row.quantity_on_hand)]));
        const submittedIds = new Set<string>();
        const prepared = [];
        for (const [index, item] of items.entries()) {
          const itemName = typeof item.name === "string" ? item.name.trim() : "";
          const unit = typeof item.unit === "string" ? item.unit.trim() : "";
          const quantity = Number(item.quantity ?? 0); const reorderLevel = Number(item.reorderLevel ?? 0);
          if (!itemName || !unit || !Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(reorderLevel) || reorderLevel < 0) throw new Error(`Item ${index + 1} needs a name, unit, and valid non-negative quantities.`);
          const attrs = item.customAttributes && typeof item.customAttributes === "object" && !Array.isArray(item.customAttributes) ? item.customAttributes as Record<string, unknown> : {};
          const normalized: Record<string, unknown> = {};
          for (const field of fieldList) {
            const supplied = attrs[field.label] ?? attrs[field.key];
            if (field.required && (supplied === undefined || supplied === null || supplied === "")) throw new Error(`Field "${field.label}" is required for every item.`);
            if (supplied === undefined || supplied === "") continue;
            const checked = validateSchemaValue(field.dataType, supplied, field.options);
            if (!checked.valid) throw new Error(`Field "${field.label}" has an invalid value.`);
            normalized[field.key] = checked.value;
          }
          const id = typeof item.id === "string" && knownItems.has(item.id) ? item.id : randomUUID();
          submittedIds.add(id); prepared.push({ id, item, itemName, unit, quantity, reorderLevel, normalized });
        }
        await connection.execute("UPDATE inventory_schema_versions SET status = 'retired' WHERE id = ?", [oldSchemaId]);
        await connection.execute("UPDATE inventory_schema_versions SET status = 'active', published_at = CURRENT_TIMESTAMP(3) WHERE id = ?", [newSchemaId]);
        for (const entry of prepared) {
          const previousQuantity = knownItems.get(entry.id);
          if (previousQuantity === undefined) {
            await connection.execute("INSERT INTO inventory_items (id, category_id, schema_version_id, item_code, name, description, unit, quantity_on_hand, reorder_level, custom_attributes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
              [entry.id, inventoryId, newSchemaId, typeof entry.item.itemCode === "string" ? entry.item.itemCode.trim().slice(0, 80) || null : null, entry.itemName.slice(0, 180), typeof entry.item.description === "string" ? entry.item.description.trim() : null, entry.unit.slice(0, 40), entry.quantity, entry.reorderLevel, JSON.stringify(entry.normalized)]);
          } else {
            await connection.execute("UPDATE inventory_items SET schema_version_id = ?, item_code = ?, name = ?, description = ?, unit = ?, reorder_level = ?, custom_attributes = ? WHERE id = ?",
              [newSchemaId, typeof entry.item.itemCode === "string" ? entry.item.itemCode.trim().slice(0, 80) || null : null, entry.itemName.slice(0, 180), typeof entry.item.description === "string" ? entry.item.description.trim() : null, entry.unit.slice(0, 40), entry.reorderLevel, JSON.stringify(entry.normalized), entry.id]);
            const difference = entry.quantity - previousQuantity;
            if (difference !== 0) await connection.execute("INSERT INTO inventory_transactions (id, inventory_item_id, movement_type, quantity, balance_after, reference, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
              [randomUUID(), entry.id, difference > 0 ? "stock_in" : "stock_out", Math.abs(difference), 0, "Manual inventory edit", "Quantity adjusted while editing the inventory table."]);
          }
        }
        for (const id of knownItems.keys()) if (!submittedIds.has(id)) await connection.execute("UPDATE inventory_items SET is_active = FALSE WHERE id = ?", [id]);
        await connection.commit();
      } catch (error) { await connection.rollback(); throw error; }
    });
    return Response.json({ id: inventoryId, name });
  } catch (error) {
    if (error instanceof Error && /not found|no active schema|needs a|Field |Add at least|invalid value/i.test(error.message)) return Response.json({ error: error.message }, { status: error.message === "Inventory not found." ? 404 : 400 });
    if ((error as { code?: string })?.code === "ER_DUP_ENTRY") return Response.json({ error: "A duplicate inventory name or item code already exists." }, { status: 409 });
    return databaseErrorResponse(error);
  }
}
