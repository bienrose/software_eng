import type { RowDataPacket } from "mysql2/promise";
import { databaseErrorResponse, withConnection } from "@/lib/mysql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateValue(value: string | null, fallback: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
  const dateFrom = dateValue(searchParams.get("dateFrom"), thirtyDaysAgo);
  const dateTo = dateValue(searchParams.get("dateTo"), today);
  const categoryId = searchParams.get("categoryId") || "";
  if (dateFrom > dateTo) return Response.json({ error: "The start date must be before the end date." }, { status: 400 });

  try {
    const result = await withConnection(async (connection) => {
      const categoryClause = categoryId ? " AND i.category_id = ?" : "";
      const categoryParams = categoryId ? [categoryId] : [];
      const [categories] = await connection.execute<RowDataPacket[]>("SELECT id, name FROM inventory_categories WHERE archived_at IS NULL ORDER BY name ASC");
      const [stockRows] = await connection.execute<RowDataPacket[]>(`
        SELECT i.id, i.name, i.item_code, i.unit, i.quantity_on_hand, i.reorder_level, c.id AS category_id, c.name AS category_name
        FROM inventory_items i INNER JOIN inventory_categories c ON c.id = i.category_id
        WHERE i.is_active = TRUE AND c.archived_at IS NULL${categoryClause}
        ORDER BY c.name ASC, i.name ASC`, categoryParams);
      const [movementRows] = await connection.execute<RowDataPacket[]>(`
        SELECT t.id, t.inventory_item_id AS item_id, i.name AS item_name, c.name AS category_name, t.movement_type, t.quantity, t.balance_after, t.reference, t.notes, t.occurred_at
        FROM inventory_transactions t
        INNER JOIN inventory_items i ON i.id = t.inventory_item_id
        INNER JOIN inventory_categories c ON c.id = i.category_id
        WHERE DATE(t.occurred_at) BETWEEN ? AND ?${categoryClause}
        ORDER BY t.occurred_at DESC`, [dateFrom, dateTo, ...categoryParams]);
      const [topUsedRows] = await connection.execute<RowDataPacket[]>(`
        SELECT i.id, i.name, i.unit, c.name AS category_name, COALESCE(SUM(t.quantity), 0) AS quantity_used
        FROM inventory_items i
        INNER JOIN inventory_categories c ON c.id = i.category_id
        LEFT JOIN inventory_transactions t ON t.inventory_item_id = i.id AND t.movement_type = 'stock_out' AND (t.reference IS NULL OR t.reference <> 'demand-sample-demo-adjustment') AND DATE(t.occurred_at) BETWEEN ? AND ?
        WHERE i.is_active = TRUE AND c.archived_at IS NULL${categoryClause}
        GROUP BY i.id, i.name, i.unit, c.name
        ORDER BY quantity_used DESC, i.name ASC LIMIT 10`, [dateFrom, dateTo, ...categoryParams]);
      const [categoryRows] = await connection.execute<RowDataPacket[]>(`
        SELECT c.id, c.name, COUNT(i.id) AS item_count, COALESCE(SUM(i.quantity_on_hand), 0) AS stock_units,
          COALESCE(SUM(CASE WHEN i.quantity_on_hand <= i.reorder_level THEN 1 ELSE 0 END), 0) AS low_stock_count
        FROM inventory_categories c
        LEFT JOIN inventory_items i ON i.category_id = c.id AND i.is_active = TRUE
        WHERE c.archived_at IS NULL${categoryId ? " AND c.id = ?" : ""}
        GROUP BY c.id, c.name ORDER BY c.name ASC`, categoryParams);
      const [predictionRows] = await connection.execute<RowDataPacket[]>(`
        SELECT p.id, p.inventory_item_id AS item_id, i.name AS item_name, c.name AS category_name, p.demand_level, p.prediction_for,
          COALESCE(SUM(CASE WHEN t.movement_type = 'stock_out' AND (t.reference IS NULL OR t.reference <> 'demand-sample-demo-adjustment') THEN t.quantity ELSE 0 END), 0) AS actual_quantity
        FROM demand_predictions p
        INNER JOIN inventory_items i ON i.id = p.inventory_item_id
        INNER JOIN inventory_categories c ON c.id = i.category_id
        LEFT JOIN inventory_transactions t ON t.inventory_item_id = p.inventory_item_id AND DATE(t.occurred_at) = p.prediction_for
        WHERE p.prediction_mode = 'classification' AND p.prediction_for BETWEEN ? AND ?${categoryClause}
        GROUP BY p.id, p.inventory_item_id, i.name, c.name, p.demand_level, p.prediction_for
        ORDER BY p.prediction_for DESC`, [dateFrom, dateTo, ...categoryParams]);
      return {
        categories: categories.map((row) => ({ id: String(row.id), name: String(row.name) })),
        stockLevels: stockRows.map((row) => ({ id: String(row.id), name: String(row.name), code: row.item_code ? String(row.item_code) : "", unit: String(row.unit), quantity: number(row.quantity_on_hand), reorderLevel: number(row.reorder_level), categoryId: String(row.category_id), categoryName: String(row.category_name) })),
        movements: movementRows.map((row) => ({ id: String(row.id), itemId: String(row.item_id), itemName: String(row.item_name), categoryName: String(row.category_name), type: String(row.movement_type), quantity: number(row.quantity), balanceAfter: number(row.balance_after), reference: row.reference ? String(row.reference) : "", notes: row.notes ? String(row.notes) : "", occurredAt: row.occurred_at })),
        topUsed: topUsedRows.map((row) => ({ id: String(row.id), name: String(row.name), unit: String(row.unit), categoryName: String(row.category_name), quantity: number(row.quantity_used) })),
        categorySummary: categoryRows.map((row) => ({ id: String(row.id), name: String(row.name), items: number(row.item_count), stock: number(row.stock_units), lowStock: number(row.low_stock_count) })),
        predictedVsActual: predictionRows.map((row) => ({ id: String(row.id), itemId: String(row.item_id), itemName: String(row.item_name), categoryName: String(row.category_name), demandLevel: String(row.demand_level), predictionFor: String(row.prediction_for), actualQuantity: number(row.actual_quantity) })),
      };
    });
    return Response.json({ ...result, filters: { dateFrom, dateTo, categoryId } });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
