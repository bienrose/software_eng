import { randomUUID } from "node:crypto";
import { databaseErrorResponse, withConnection } from "@/lib/mysql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  let body: { action?: unknown };
  try {
    body = await request.json() as { action?: unknown };
  } catch {
    return Response.json({ error: "Send a valid JSON request body." }, { status: 400 });
  }
  const action = body.action === "approved" || body.action === "dismissed" ? body.action : null;
  if (!action) return Response.json({ error: "Action must be approved or dismissed." }, { status: 400 });
  try {
    await withConnection(async (connection) => {
      const [items] = await connection.execute("SELECT id FROM inventory_items WHERE id = ? LIMIT 1", [itemId]);
      if (!Array.isArray(items) || items.length === 0) throw new Error("not_found");
      await connection.execute(
        "INSERT INTO audit_logs (id, action, entity_type, entity_id, after_data) VALUES (?, ?, 'replenishment_recommendation', ?, ?)",
        [randomUUID(), `replenishment_${action}`, itemId, JSON.stringify({ action, recordedAt: new Date().toISOString() })],
      );
    });
    return Response.json({ itemId, action });
  } catch (error) {
    if (error instanceof Error && error.message === "not_found") return Response.json({ error: "Inventory item not found." }, { status: 404 });
    return databaseErrorResponse(error);
  }
}
