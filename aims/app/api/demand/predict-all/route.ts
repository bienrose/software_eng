import { demandServiceRequest } from "@/lib/demand-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return demandServiceRequest("/predict-all");
}
