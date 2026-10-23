import { demandServiceRequest } from "@/lib/demand-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a valid JSON request body." }, { status: 400 });
  }
  return demandServiceRequest("/train", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
