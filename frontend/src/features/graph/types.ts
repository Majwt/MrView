export type Customer = {
  name: string
  cmdb_ci_id: string
  id: number
}

export type GraphNode = {
  fqdn: string
  ip: string
  subnet: string | null
  customer: Customer
  first_seen: string
}

export type GraphEdge = {
  id: string

  source_ip: string
  source_port: number
  source_fqdn: string

  target_ip: string
  target_port: number
  target_fqdn: string

  pid: number | null
  process_name: string | null

  seen_count: number

  source_pid: number | null
  source_process_name: string | null

  target_pid: number | null
  target_process_name: string | null

  last_seen: string
}

export type GraphCursor = {
  last_seen: string
  last_row_id: number
}

export type GraphSnapshot = {
  nodes: GraphNode[]
  edges: GraphEdge[]
  cursor: GraphCursor
}

export type GraphDelta = GraphSnapshot
