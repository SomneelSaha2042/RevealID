type FetchLike = typeof fetch;

export type HealthStatus = "API reachable" | "API unavailable";

export function getServerApiBaseUrl() {
  return process.env.API_BASE_URL ?? "http://localhost:4000";
}

export async function getHealth(fetchImpl: FetchLike = fetch): Promise<HealthStatus> {
  try {
    const response = await fetchImpl(`${getServerApiBaseUrl()}/health`, { cache: "no-store" });
    return response.ok ? "API reachable" : "API unavailable";
  } catch {
    return "API unavailable";
  }
}
