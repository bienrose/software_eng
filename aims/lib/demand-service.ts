type DemandServiceError = { detail?: { message?: string; code?: string } | string };

function serviceUrl(path: string) {
  const baseUrl = process.env.DEMAND_SERVICE_URL || "http://127.0.0.1:8000";
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

export async function demandServiceRequest(path: string, init?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(serviceUrl(path), { cache: "no-store", ...init });
  } catch {
    return Response.json(
      { error: "The demand prediction service is unavailable. Start the Python service and try again." },
      { status: 503 },
    );
  }
  const result: DemandServiceError = await response.json();
  if (!response.ok) {
    const detail = "detail" in result ? result.detail : undefined;
    const message = typeof detail === "string" ? detail : detail?.message || "Demand prediction could not be completed.";
    return Response.json({ error: message, detail }, { status: response.status });
  }
  return Response.json(result, { status: response.status });
}
