import type { RowDataPacket } from "mysql2/promise";
import { databaseErrorResponse, withConnection } from "@/lib/mysql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET() {
  try {
    const items = await withConnection(async (connection) => {
      const [rows] = await connection.execute<RowDataPacket[]>(`
        SELECT i.id, i.name, i.item_code, i.unit, i.quantity_on_hand, i.reorder_level, c.name AS category_name,
          COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(i.custom_attributes, '$.lead_time_days')) AS DECIMAL(10, 2)), 7) AS lead_time_days,
          COALESCE((SELECT SUM(t.quantity) FROM inventory_transactions t WHERE t.inventory_item_id = i.id AND t.movement_type = 'stock_out' AND (t.reference IS NULL OR t.reference <> 'demand-sample-demo-adjustment') AND t.occurred_at >= DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 30 DAY)), 0) AS used_last_30_days,
          COALESCE((SELECT MAX(t.quantity) FROM inventory_transactions t WHERE t.inventory_item_id = i.id AND t.movement_type = 'stock_out' AND (t.reference IS NULL OR t.reference <> 'demand-sample-demo-adjustment') AND t.occurred_at >= DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 30 DAY)), 0) AS max_daily_used,
          (SELECT p.demand_level FROM demand_predictions p WHERE p.inventory_item_id = i.id AND p.prediction_mode = 'classification' ORDER BY p.generated_at DESC LIMIT 1) AS demand_level
        FROM inventory_items i INNER JOIN inventory_categories c ON c.id = i.category_id
        WHERE i.is_active = TRUE AND c.archived_at IS NULL
        ORDER BY i.name ASC`);
      return rows;
    });
    const recommendations = items.map((row) => {
      const quantity = number(row.quantity_on_hand);
      const leadTimeDays = Math.max(number(row.lead_time_days), 1);
      const dailyUse = number(row.used_last_30_days) / 30;
      const maxDailyUse = number(row.max_daily_used);
      const safetyStock = Math.ceil(Math.max(0, maxDailyUse - dailyUse) * Math.sqrt(leadTimeDays));
      const reorderPoint = Math.ceil(dailyUse * leadTimeDays + safetyStock);
      const targetStock = Math.ceil(dailyUse * (leadTimeDays + 30) + safetyStock);
      const suggestedQuantity = Math.max(0, targetStock - quantity);
      const daysRemaining = dailyUse > 0 ? quantity / dailyUse : null;
      const status = quantity <= safetyStock ? "Critical" : quantity <= reorderPoint ? "Low" : quantity > targetStock * 1.5 ? "Overstock" : "Healthy";
      const demandLevel = row.demand_level === "high" ? "High" : row.demand_level === "moderate" ? "Medium" : row.demand_level === "low" ? "Low" : "Unknown";
      const recommendation = status === "Critical" || status === "Low"
        ? `Reorder now: ${demandLevel === "Unknown" ? "demand prediction unavailable" : `${demandLevel} demand`}, ${daysRemaining === null ? "no recent usage rate" : `${Math.ceil(daysRemaining)} days of stock left`}.`
        : status === "Overstock"
          ? "Pause replenishment: current stock exceeds the 30-day target."
          : "No immediate replenishment needed.";
      const priority = status === "Critical" ? 0 : status === "Low" && demandLevel === "High" ? 1 : status === "Low" ? 2 : status === "Healthy" ? 3 : 4;
      return { id: String(row.id), name: String(row.name), code: row.item_code ? String(row.item_code) : "", unit: String(row.unit), categoryName: String(row.category_name), quantity, leadTimeDays, dailyUse, safetyStock, reorderPoint, suggestedQuantity, daysRemaining, status, demandLevel, recommendation, priority };
    }).sort((left, right) => left.priority - right.priority || (left.daysRemaining ?? Number.POSITIVE_INFINITY) - (right.daysRemaining ?? Number.POSITIVE_INFINITY));
    return Response.json({ recommendations });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
