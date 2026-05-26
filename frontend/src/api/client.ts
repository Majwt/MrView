const API_BASE_URL = import.meta.env.VITE_API_URL ?? "/api"

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Accept: "application/json",
    },
  })

  if (!response.ok) {
    throw new Error(`GET ${path} failed with status ${response.status}`)
  }

  return response.json() as Promise<T>
}
