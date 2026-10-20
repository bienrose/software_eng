import type { RowDataPacket } from "mysql2/promise";
import { databaseErrorResponse, withConnection } from "@/lib/mysql";

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
