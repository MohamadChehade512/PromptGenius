import { HealthResponse } from '@promptgenius/api-contract';

/** Every API response is validated against the shared contract before use. */
export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const res = await fetch('/api/health', { signal });
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return HealthResponse.parse(await res.json());
}
