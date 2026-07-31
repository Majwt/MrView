import { getStoredToken } from "@/auth/AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getStoredToken();
  return token
    ? { ...extra, Authorization: `Bearer ${token}` }
    : extra;
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: authHeaders({ Accept: "application/json" }),
  });

  if (!response.ok) {
    throw new Error(`GET ${path} failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function apiGetText<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: authHeaders({ Accept: "text/plain" }),
  });

  if (!response.ok) {
    throw new Error(`GET ${path} failed with status ${response.status}`);
  }

  return response.text() as Promise<T>;
}
