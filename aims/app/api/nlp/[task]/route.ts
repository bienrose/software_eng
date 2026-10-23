import { demandServiceRequest } from "@/lib/demand-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supportedTasks = new Set(["infer-schema", "stock-command"]);

export async function POST(request: Request, { params }: { params: Promise<{ task: string }> }) {
  const { task } = await params;
  if (!supportedTasks.has(task)) return Response.json({ error: "Unknown NLP task." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a valid JSON request body." }, { status: 400 });
  }

  return demandServiceRequest(`/nlp/${task}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
