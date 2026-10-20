import { randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { databaseErrorResponse, withConnection } from "@/lib/mysql";
import { validateSchemaValue } from "@/lib/schema-value";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value) as unknown; } catch { return null; }
}

export async function POST(request: Request, { params }: { params: Promise<{ inventoryId: string }> }) {
  const { inventoryId } = await params;
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return Response.json({ error: "Send a JSON object." }, { status: 400 });
    body = parsed as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Send a valid JSON request body." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const unit = typeof body.unit === "string" ? body.unit.trim() : "";
  const quantity = Number(body.quantity ?? 0);
  const reorderLevel = Number(body.reorderLevel ?? 0);
  if (!name || !unit || name.length > 180 || unit.length > 40) return Response.json({ error: "Item name and unit are required." }, { status: 400 });
  if (!Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(reorderLevel) || reorderLevel < 0) {
    return Response.json({ error: "Quantity and reorder level must be non-negative numbers." }, { status: 400 });
  }
  const suppliedAttributes = body.customAttributes && typeof body.customAttributes === "object" && !Array.isArray(body.customAttributes)
    ? body.customAttributes as Record<string, unknown>
    : {};

  try {
    const item = await withConnection(async (connection) => {
      const [schemaRows] = await connection.execute<RowDataPacket[]>(
        `SELECT s.id FROM inventory_schema_versions s
         INNER JOIN inventory_categories c ON c.id = s.category_id
         WHERE s.category_id = ? AND s.status = 'active' AND c.archived_at IS NULL LIMIT 1`,
        [inventoryId],
      );
      if (!schemaRows.length) return null;
      const schemaId = schemaRows[0].id as string;
      const [fieldRows] = await connection.execute<RowDataPacket[]>(
        "SELECT field_key, label, data_type, is_required, options FROM inventory_schema_fields WHERE schema_version_id = ? ORDER BY display_order",
        [schemaId],
      );
      const attributes: Record<string, unknown> = {};
      for (const field of fieldRows) {
        const value = suppliedAttributes[String(field.field_key)];
        const labeledValue = suppliedAttributes[String(field.label)];
        const fieldValue = value ?? labeledValue;
        if (Boolean(field.is_required) && (fieldValue === undefined || fieldValue === null || fieldValue === "")) {
          throw new Error(`Field "${String(field.label)}" is required.`);
        }
        if (fieldValue !== undefined && fieldValue !== "") {
          const options = parseJson(field.options);
          const validated = validateSchemaValue(String(field.data_type), fieldValue, Array.isArray(options) ? options : []);
          if (!validated.valid) throw new Error(`Field "${String(field.label)}" has an invalid ${String(field.data_type)} value.`);
          attributes[String(field.field_key)] = validated.value;
        }
      }

      const id = randomUUID();
      await connection.execute(
        `INSERT INTO inventory_items
          (id, category_id, schema_version_id, item_code, name, description, unit, quantity_on_hand, reorder_level, custom_attributes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, inventoryId, schemaId,
          typeof body.itemCode === "string" && body.itemCode.trim() ? body.itemCode.trim().slice(0, 80) : null,
          name, typeof body.description === "string" ? body.description.trim().slice(0, 5000) : null,
          unit, quantity, reorderLevel, JSON.stringify(attributes)],
      );
      const [itemRows] = await connection.execute<RowDataPacket[]>(
        `SELECT id, item_code, name, description, unit, quantity_on_hand, reorder_level, custom_attributes, created_at, updated_at
         FROM inventory_items WHERE id = ? LIMIT 1`, [id],
      );
      const row = itemRows[0];
      return {
        id: row.id, code: row.item_code, name: row.name, description: row.description,
        unit: row.unit, quantity: Number(row.quantity_on_hand), reorderLevel: Number(row.reorder_level),
        customAttributes: parseJson(row.custom_attributes) ?? {}, createdAt: row.created_at, updatedAt: row.updated_at,
      };
    });
    if (!item) return Response.json({ error: "Inventory not found or has no active schema." }, { status: 404 });
    return Response.json({ item }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Field ")) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if ((error as { code?: string })?.code === "ER_NO_REFERENCED_ROW_2") return Response.json({ error: "Inventory not found." }, { status: 404 });
    return databaseErrorResponse(error);
  }
}
