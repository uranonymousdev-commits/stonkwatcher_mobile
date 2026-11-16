import { API_URL, PARTNER_API_KEY } from "./config";
import { dedupe, fetchWithTimeout } from "./http";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function requestHeaders(jsonBody = false): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (jsonBody) headers["Content-Type"] = "application/json";
  if (PARTNER_API_KEY) headers.Authorization = `Bearer ${PARTNER_API_KEY}`;
  return headers;
}

function buildUrl(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
) {
  const url = new URL(path.startsWith("/") ? path : `/${path}`, `${API_URL}/`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function readError(response: Response) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error || `Request failed (${response.status})`;
}

export function apiGet<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
  signal?: AbortSignal,
): Promise<T> {
  const url = buildUrl(path, params);
  const run = async () => {
    const response = await fetchWithTimeout(url, {
      method: "GET",
      signal,
      headers: requestHeaders(),
    });
    if (!response.ok) throw new ApiError(await readError(response), response.status);
    return (await response.json()) as T;
  };
  // A caller-owned signal could cancel a request other callers share, so only
  // unsignalled GETs are coalesced.
  return signal ? run() : dedupe(`GET ${url}`, run);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetchWithTimeout(buildUrl(path), {
    method: "POST",
    headers: requestHeaders(true),
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new ApiError(await readError(response), response.status);
  return (await response.json()) as T;
}
