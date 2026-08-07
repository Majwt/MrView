import { getStoredToken, setTokenRef } from "@/auth/AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

// Single in-flight refresh promise prevents storms when multiple requests 401 simultaneously
let _refreshInFlight: Promise<string | null> | null = null;

async function silentRefresh(): Promise<string | null> {
  if (_refreshInFlight) return _refreshInFlight;
  _refreshInFlight = fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  })
    .then(r => r.ok ? (r.json() as Promise<{ token: string }>) : Promise.reject())
    .then(({ token }) => { setTokenRef(token); return token; })
    .catch(() => null)
    .finally(() => { _refreshInFlight = null; });
  return _refreshInFlight;
}

function authHeaders(token: string | null, extra: Record<string, string> = {}): Record<string, string> {
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

async function apiFetch(path: string, init: { headers?: Record<string, string> } & RequestInit = {}): Promise<Response> {
  let token = getStoredToken();
  let response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: authHeaders(token, init.headers),
  });

  if (response.status === 401) {
    const newToken = await silentRefresh();
    if (!newToken) {
      setTokenRef(null);
      window.location.replace("/login");
      throw new Error("Session expired");
    }
    token = newToken;
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: authHeaders(token, init.headers),
    });
  }

  return response;
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await apiFetch(path, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`GET ${path} failed with status ${response.status}`);
  return response.json() as Promise<T>;
}

export async function apiGetText<T>(path: string): Promise<T> {
  const response = await apiFetch(path, { headers: { Accept: "text/plain" } });
  if (!response.ok) throw new Error(`GET ${path} failed with status ${response.status}`);
  return response.text() as Promise<T>;
}
