import { randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { databaseErrorResponse, withConnection } from "@/lib/mysql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  let body: { kind?: unknown; quantity?: unknown; reference?: unknown; notes?: unknown };
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return Response.json({ error: "Send a JSON object." }, { status: 400 });
    body = parsed as typeof body;
  } catch {
    return Response.json({ error: "Send a valid JSON request body." }, { status: 400 });
  }

  const kind = body.kind === "stock_in" || body.kind === "stock_out" ? body.kind : null;
  const quantity = Number(body.quantity);
  if (!kind) return Response.json({ error: "Movement type must be stock_in or stock_out." }, { status: 400 });
  if (!Number.isFinite(quantity) || quantity <= 0) return Response.json({ error: "Enter a quantity greater than zero." }, { status: 400 });
  const reference = typeof body.reference === "string" ? body.reference.trim().slice(0, 120) : null;
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 5000) : null;
  const id = randomUUID();

  try {
    const movement = await withConnection(async (connection) => {
      await connection.execute(
        `INSERT INTO inventory_transactions
          (id, inventory_item_id, movement_type, quantity, balance_after, reference, notes)
         VALUES (?, ?, ?, ?, 0, ?, ?)`,
        [id, itemId, kind, quantity, reference, notes],
      );
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT t.id, t.inventory_item_id, i.category_id, i.name AS item_name,
                t.movement_type, t.quantity, t.balance_after, t.reference, t.notes, t.occurred_at
         FROM inventory_transactions t INNER JOIN inventory_items i ON i.id = t.inventory_item_id
         WHERE t.id = ? LIMIT 1`,
        [id],
      );
      const row = rows[0];
      return {
        id: row.id,
        itemId: row.inventory_item_id,
        inventoryId: row.category_id,
        itemName: row.item_name,
        kind: row.movement_type,
        quantity: Number(row.quantity),
        balanceAfter: Number(row.balance_after),
        reference: row.reference,
        notes: row.notes,
        occurredAt: row.occurred_at,
      };
    });
    return Response.json({ movement }, { status: 201 });
  } catch (error) {
    const dbError = error as { code?: string; sqlMessage?: string };
    if (dbError.code === "ER_SIGNAL_EXCEPTION") {
      const message = dbError.sqlMessage?.includes("Insufficient stock")
        ? "The stock-out quantity exceeds the available balance. Refresh inventory and try again."
        : "The movement could not be recorded for this item.";
      return Response.json({ error: message }, { status: 409 });
    }
    if (dbError.code === "ER_NO_REFERENCED_ROW_2") return Response.json({ error: "Inventory item not found." }, { status: 404 });
    return databaseErrorResponse(error);
  }
}
