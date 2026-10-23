import { demandServiceRequest } from "@/lib/demand-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  return demandServiceRequest(`/predict/${encodeURIComponent(itemId)}`);
}
