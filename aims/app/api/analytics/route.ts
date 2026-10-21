import type { RowDataPacket } from "mysql2/promise";
import { databaseErrorResponse, withConnection } from "@/lib/mysql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET() {
  try {
    const result = await withConnection(async (connection) => {
      const [inventoryRows] = await connection.execute<RowDataPacket[]>(`
        SELECT c.id, c.name, c.description,
          (SELECT COUNT(*) FROM inventory_items i WHERE i.category_id = c.id AND i.is_active = TRUE) AS item_count,
          (SELECT COALESCE(SUM(i.quantity_on_hand), 0) FROM inventory_items i WHERE i.category_id = c.id AND i.is_active = TRUE) AS total_units,
          (SELECT COUNT(*) FROM inventory_items i WHERE i.category_id = c.id AND i.is_active = TRUE AND i.quantity_on_hand > 0 AND i.quantity_on_hand <= i.reorder_level) AS low_stock_count,
          (SELECT COUNT(*) FROM inventory_items i WHERE i.category_id = c.id AND i.is_active = TRUE AND i.quantity_on_hand = 0) AS out_of_stock_count
        FROM inventory_categories c
        WHERE c.archived_at IS NULL
        ORDER BY c.name ASC`);

      const [itemRows] = await connection.execute<RowDataPacket[]>(`
        SELECT c.id AS inventory_id, c.name AS inventory_name,
          i.id AS item_id, i.name AS item_name, i.item_code, i.unit,
          i.quantity_on_hand, i.reorder_level,
          COALESCE(SUM(CASE WHEN t.movement_type = 'stock_out' THEN t.quantity ELSE 0 END), 0) AS issued_last_30_days
        FROM inventory_categories c
        INNER JOIN inventory_items i ON i.category_id = c.id AND i.is_active = TRUE
        LEFT JOIN inventory_transactions t
          ON t.inventory_item_id = i.id
          AND t.occurred_at >= DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 30 DAY)
        WHERE c.archived_at IS NULL
        GROUP BY c.id, c.name, i.id, i.name, i.item_code, i.unit, i.quantity_on_hand, i.reorder_level
        ORDER BY c.name ASC, i.name ASC`);

      return {
        inventories: inventoryRows.map((row) => ({
          id: String(row.id),
          name: String(row.name),
          description: row.description == null ? "" : String(row.description),
          itemCount: asNumber(row.item_count),
          totalUnits: asNumber(row.total_units),
          lowStockCount: asNumber(row.low_stock_count),
          outOfStockCount: asNumber(row.out_of_stock_count),
        })),
        items: itemRows.map((row) => ({
          inventoryId: String(row.inventory_id),
          inventoryName: String(row.inventory_name),
          id: String(row.item_id),
          name: String(row.item_name),
          code: row.item_code == null ? "" : String(row.item_code),
          unit: String(row.unit),
          quantity: asNumber(row.quantity_on_hand),
          reorderLevel: asNumber(row.reorder_level),
          issuedLast30Days: asNumber(row.issued_last_30_days),
        })),
      };
    });

    return Response.json(result);
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
