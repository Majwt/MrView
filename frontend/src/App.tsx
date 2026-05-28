import { SidebarInset, SidebarProvider, SidebarTrigger } from "./components/ui/sidebar";
import { AppSidebar } from "./components/AppSidebar";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import GraphView from "./components/GraphView";
import { DataTable } from "@/components/table/data-table";
import { connectionColumns, type TableConnection } from "@/components/table/connection-columns";
import { nodeColumns, type TableNode } from "@/components/table/node-columns";
import { useEffect, useMemo, useReducer, useState } from "react";
import type { GraphSnapshot } from "./features/graph/types";
import { fetchGraphDelta, fetchGraphSnapshot } from "./api/graph-api";
import { applyGraphDelta } from "./features/graph/apply-graph-delta";
import FilterBar from "./components/FilterBar";
import { filtersReducer, initialFilters } from "./features/filters/filters-reducer";
import { applyGraphFilters } from "./features/filters/apply-graph-filters";
import { X } from "lucide-react";

const REFRESH_INTERVAL_MS = 1 * 60 * 1000; // 1 minutes

export function App() {
  const [snapshot, setSnapshot] = useState<GraphSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tableView, setTableView] = useState<"nodes" | "connections">("nodes");
  const [selectedNodeFqdn, setSelectedNodeFqdn] = useState<string | null>(null);
  const [hoveredNodeFqdn, setHoveredNodeFqdn] = useState<string | null>(null);
  const [hoveredConnectionIds, setHoveredConnectionIds] = useState<Set<string>>(() => new Set());
  const [nodeSearch, setNodeSearch] = useState("");
  const [connectionSearch, setConnectionSearch] = useState("");

  const [filters, dispatchFilters] = useReducer(filtersReducer, initialFilters);

  const nodeFilteredSnapshot = useMemo(() => {
    if (!snapshot) return null;

    return applyGraphFilters(snapshot, filters, "node");
  }, [snapshot, filters]);

  const connectionFilteredSnapshot = useMemo(() => {
    if (!snapshot) return null;

    return applyGraphFilters(snapshot, filters, "connection");
  }, [snapshot, filters]);

  const selectedNodeConnectionSnapshot = useMemo(() => {
    if (!connectionFilteredSnapshot || !selectedNodeFqdn) {
      return connectionFilteredSnapshot;
    }

    const edges = connectionFilteredSnapshot.edges.filter(
      (edge) => edge.source_fqdn === selectedNodeFqdn || edge.target_fqdn === selectedNodeFqdn,
    );
    const connectedNodeIds = new Set<string>();

    for (const edge of edges) {
      connectedNodeIds.add(edge.source_fqdn);
      connectedNodeIds.add(edge.target_fqdn);
    }

    return {
      ...connectionFilteredSnapshot,
      nodes: connectionFilteredSnapshot.nodes.filter((node) => connectedNodeIds.has(node.fqdn)),
      edges,
    };
  }, [connectionFilteredSnapshot, selectedNodeFqdn]);

  const graphSnapshot =
    tableView === "nodes" ? nodeFilteredSnapshot : selectedNodeConnectionSnapshot;

  const visibleNodeIds = useMemo(
    () => new Set(graphSnapshot?.nodes.map((node) => node.fqdn) ?? []),
    [graphSnapshot],
  );

  const visibleEdgeIds = useMemo(
    () => new Set(graphSnapshot?.edges.map((edge) => edge.id) ?? []),
    [graphSnapshot],
  );

  const tableNodes: TableNode[] = useMemo(() => {
    if (nodeFilteredSnapshot == null) return [];

    const tableNodes = nodeFilteredSnapshot.nodes.map((node) => {
      const tableNode: TableNode = {
        id: node.id,
        fqdn: node.fqdn,
        ipv4: node.interfaces[0].ip, // figure out how to display multiple interfaces in the table
        mac_address: node.interfaces[0].mac,
        hostname: node.hostname,
        distinct_edges: node.distinct_edge,
        connections: node.connection_count,
        firstSeen: node.first_seen,
        lastSeen: node.last_seen,
      };

      return tableNode;
    });

    return tableNodes;
  }, [nodeFilteredSnapshot]);

  const tableConnections: TableConnection[] = useMemo(() => {
    if (selectedNodeConnectionSnapshot == null) return [];

    return selectedNodeConnectionSnapshot.edges.map((edge) => ({
      id: edge.id,
      source: edge.source_fqdn,
      sourceIp: edge.source_ip,
      sourcePort: edge.source_port,
      target: edge.target_fqdn,
      targetIp: edge.target_ip,
      targetPort: edge.target_port,
      protocol: edge.protocol,
      serviceName: edge.service_name,
      seenCount: edge.seen_count,
      firstSeen: edge.first_seen,
      lastSeen: edge.last_seen,
    }));
  }, [selectedNodeConnectionSnapshot]);

  function selectNodeConnections(fqdn: string) {
    setSelectedNodeFqdn(fqdn);
    setTableView("connections");
  }

  function setHoveredConnectionId(id: string | null) {
    setHoveredConnectionIds(id ? new Set([id]) : new Set());
  }

  useEffect(() => {
    async function loadGraph() {
      try {
        setIsLoading(true);
        setError(null);

        const data = await fetchGraphSnapshot();

        const snapshot: GraphSnapshot = {
          nodes: data.upsert_nodes,
          edges: data.upsert_edges,
          cursor: data.cursor,
        };

        setSnapshot(snapshot);
      } catch (error) {
        setError(error instanceof Error ? error.message : "Failed to load graph");
      } finally {
        setIsLoading(false);
      }
    }

    loadGraph();
  }, []);

  // Delta refresh every 5 minutes
  useEffect(() => {
    if (!snapshot?.cursor) return;

    const intervalId = window.setInterval(async () => {
      try {
        const delta = await fetchGraphDelta(snapshot.cursor);

        setSnapshot((current) => {
          if (!current) return current;

          return applyGraphDelta(current, delta);
        });
      } catch (error) {
        console.error("Failed to fetch graph delta", error);
      }
    }, REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [snapshot]);

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading graph...</div>;
  }

  if (error) {
    return <div className="p-6 text-sm text-destructive">{error}</div>;
  }
  return (
    <SidebarProvider>
      <AppSidebar />

      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <div>
            <h1 className="text-sm font-medium">Graph</h1>
          </div>
        </header>

        <main className="grid h-[calc(100vh-3.5rem)] grid-rows-2 overflow-hidden">
          <section className="min-h-0 border-b">
            {snapshot ? (
              <GraphView
                edges={snapshot.edges}
                nodes={snapshot.nodes}
                visibleEdgeIds={visibleEdgeIds}
                visibleNodeIds={visibleNodeIds}
                hoveredEdgeIds={hoveredConnectionIds}
                hoveredNodeId={hoveredNodeFqdn}
                onEdgeHoverChange={(edgeIds) => setHoveredConnectionIds(new Set(edgeIds))}
                onNodeHoverChange={setHoveredNodeFqdn}
                onNodeSelect={selectNodeConnections}
              />
            ) : (
              <div className="p-6 text-sm text-muted-foreground">No data to display.</div>
            )}
          </section>

          <section className="flex min-h-0 flex-col overflow-hidden p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <Input
                  className="h-8 w-56"
                  placeholder={tableView === "nodes" ? "Search nodes..." : "Search connections..."}
                  value={tableView === "nodes" ? nodeSearch : connectionSearch}
                  onChange={(event) =>
                    tableView === "nodes"
                      ? setNodeSearch(event.target.value)
                      : setConnectionSearch(event.target.value)
                  }
                />

                {tableView === "nodes" ? (
                  <FilterBar dispatch={dispatchFilters} filters={filters} target="node" />
                ) : (
                  <>
                    <FilterBar dispatch={dispatchFilters} filters={filters} target="connection" />
                    {selectedNodeFqdn ? (
                      <div className="inline-flex h-7 items-center gap-2 rounded-md border bg-muted px-2 text-xs">
                        <span>Connected to {selectedNodeFqdn}</span>
                        <button
                          type="button"
                          aria-label={`Clear selected node ${selectedNodeFqdn}`}
                          className="rounded-sm p-0.5 hover:bg-background/70"
                          onClick={() => setSelectedNodeFqdn(null)}
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </div>

              <div className="ml-auto flex shrink-0 rounded-md border p-0.5">
                <Button
                  variant={tableView === "nodes" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7"
                  onClick={() => setTableView("nodes")}
                >
                  Nodes
                </Button>
                <Button
                  variant={tableView === "connections" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7"
                  onClick={() => setTableView("connections")}
                >
                  Connections
                </Button>
              </div>
            </div>

            {tableView === "nodes" ? (
              <DataTable
                columns={nodeColumns}
                data={tableNodes}
                getRowHoverId={(row) => row.fqdn}
                globalFilter={nodeSearch}
                hoveredRowId={hoveredNodeFqdn}
                onGlobalFilterChange={setNodeSearch}
                onRowHoverChange={setHoveredNodeFqdn}
              />
            ) : (
              <DataTable
                columns={connectionColumns}
                data={tableConnections}
                getRowHoverId={(row) => row.id}
                globalFilter={connectionSearch}
                hoveredRowIds={hoveredConnectionIds}
                onGlobalFilterChange={setConnectionSearch}
                onRowHoverChange={setHoveredConnectionId}
              />
            )}
          </section>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default App;
