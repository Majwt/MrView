
# AxiLANswer Api

To run as IIS web app you need the [dotnet Hosting Runtime](https://dotnet.microsoft.com/en-us/download/dotnet/10.0).

## Graph endpoints

- `GET /api/graph` returns the full graph payload (`nodes`, `edges`) for backwards compatibility.
- `GET /api/graph/snapshot` returns full graph data and a cursor (`cursor.last_seen`, `cursor.last_row_id`).
- `GET /api/graph/delta?since_last_seen=<ISO>&since_row_id=<row-id>` returns incremental updates:
  - `upsert_nodes`
  - `upsert_edges`
  - `remove_node_ids`
  - `remove_edge_ids`
  - `cursor`

