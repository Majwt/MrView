import { apiGet } from "@/api/client"
import type {
  GraphCursor,
  GraphDelta,
  GraphSnapshot,
} from "@/features/graph/types"

export function fetchGraphSnapshot(): Promise<GraphSnapshot> {
  return apiGet<GraphSnapshot>("/graph/snapshot")
}

export function fetchGraphDelta(cursor: GraphCursor): Promise<GraphDelta> {
  const params = new URLSearchParams({
    since_last_seen: cursor.last_seen,
    since_row_id: String(cursor.last_row_id),
  })

  return apiGet<GraphDelta>(`/graph/delta?${params.toString()}`)
}
