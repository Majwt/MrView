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
import { normalizeGraphSnapshot } from "./features/graph/normalize-graph-snapshot";
import FilterBar from "./components/FilterBar";
import { filtersReducer, initialFilters } from "./features/filters/filters-reducer";
import { applyGraphFilters } from "./features/filters/apply-graph-filters";
import { buildFilterSuggestions } from "./features/filters/filter-suggestions";
import { applyGlobalSearch } from "./features/filters/apply-global-search";
import { Badge } from "./components/ui/badge";
import { X } from "lucide-react";

const REFRESH_INTERVAL_MS = 1 * 60 * 1000; // 1 minutes

export function App() {
  const [snapshot, setSnapshot] = useState<GraphSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tableView, setTableView] = useState<"nodes" | "connections">("nodes");
  const [selectedNodeFqdn, setSelectedNodeFqdn] = useState<string | null>(null);
  const [hoveredNodeFqdn, setHoveredNodeFqdn] = useState<string | null>(null);
  const [hoveredNodePosition, setHoveredNodePosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [hoveredConnectionIds, setHoveredConnectionIds] = useState<Set<string>>(() => new Set());
  const [globalSearch, setGlobalSearch] = useState("");

  const [filters, dispatchFilters] = useReducer(filtersReducer, initialFilters);
  const filterSuggestions = useMemo(() => buildFilterSuggestions(snapshot), [snapshot]);

  const nodeFilteredSnapshot = useMemo(() => {
    if (!snapshot) return null;

    return applyGraphFilters(snapshot, filters, "node");
  }, [snapshot, filters]);
  const nodeSearchedSnapshot = useMemo(
    () => applyGlobalSearch(nodeFilteredSnapshot, globalSearch, "node"),
    [nodeFilteredSnapshot, globalSearch],
  );

  const connectionFilteredSnapshot = useMemo(() => {
    if (!snapshot) return null;

    return applyGraphFilters(snapshot, filters, "connection");
  }, [snapshot, filters]);
  const connectionSearchedSnapshot = useMemo(
    () => applyGlobalSearch(connectionFilteredSnapshot, globalSearch, "connection"),
    [connectionFilteredSnapshot, globalSearch],
  );

  const selectedNodeConnectionSnapshot = useMemo(() => {
    if (!connectionSearchedSnapshot || !selectedNodeFqdn) {
      return connectionSearchedSnapshot;
    }

    const edges = connectionSearchedSnapshot.edges.filter(
      (edge) => edge.source_fqdn === selectedNodeFqdn || edge.target_fqdn === selectedNodeFqdn,
    );
    const connectedNodeIds = new Set<string>();

    for (const edge of edges) {
      connectedNodeIds.add(edge.source_fqdn);
      connectedNodeIds.add(edge.target_fqdn);
    }

    return {
      ...connectionSearchedSnapshot,
      nodes: connectionSearchedSnapshot.nodes.filter((node) => connectedNodeIds.has(node.fqdn)),
      edges,
    };
  }, [connectionSearchedSnapshot, selectedNodeFqdn]);

  const graphSnapshot =
    tableView === "nodes" ? nodeSearchedSnapshot : selectedNodeConnectionSnapshot;

  const visibleNodeIds = useMemo(
    () => new Set(graphSnapshot?.nodes.map((node) => node.fqdn) ?? []),
    [graphSnapshot],
  );

  const visibleEdgeIds = useMemo(
    () => new Set(graphSnapshot?.edges.map((edge) => edge.id) ?? []),
    [graphSnapshot],
  );
  const nodesByFqdn = useMemo(
    () => new Map((snapshot?.nodes ?? []).map((node) => [node.fqdn, node])),
    [snapshot],
  );
  const selectedNode = selectedNodeFqdn ? nodesByFqdn.get(selectedNodeFqdn) : undefined;
  const contextNodeFqdn = hoveredNodeFqdn ?? selectedNodeFqdn;
  const contextNode = contextNodeFqdn ? nodesByFqdn.get(contextNodeFqdn) : undefined;
  const primaryInterface = contextNode?.interfaces[0];

  const tableNodes: TableNode[] = useMemo(() => {
    if (nodeSearchedSnapshot == null) return [];

    const tableNodes = nodeSearchedSnapshot.nodes.map((node) => {
      const tableNode: TableNode = {
        id: node.id,
        fqdn: node.fqdn,
        ipv4: node.interfaces[0]?.ip ?? "",
        mac_address: node.interfaces[0]?.mac ?? "",
        hostname: node.hostname,
        distinct_edges: node.distinct_edge,
        connections: node.connection_count,
        firstSeen: node.first_seen,
        lastSeen: node.last_seen,
      };

      return tableNode;
    });

    return tableNodes;
  }, [nodeSearchedSnapshot]);

  const tableConnections: TableConnection[] = useMemo(() => {
    if (selectedNodeConnectionSnapshot == null) return [];

    return selectedNodeConnectionSnapshot.edges.map((edge) => ({
      id: edge.id,
      source: edge.source_fqdn,
      sourceIp: edge.source_ip,
      sourcePort: edge.source_port,
      sourceProcess: edge.source_process_name ?? "",
      target: edge.target_fqdn,
      targetIp: edge.target_ip,
      targetPort: edge.target_port,
      targetProcess: edge.target_process_name ?? "",
      protocol: edge.protocol,
      serviceName: edge.service_name,
      seenCount: edge.seen_count,
      firstSeen: edge.first_seen,
      lastSeen: edge.last_seen,
    }));
  }, [selectedNodeConnectionSnapshot]);

  function selectNodeConnections(fqdn: string) {
    setSelectedNodeFqdn(fqdn);
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

        const snapshot = normalizeGraphSnapshot({
          nodes: data.upsert_nodes,
          edges: data.upsert_edges,
          cursor: data.cursor,
        });

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
          <section className="relative min-h-0 border-b">
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
                onNodeHoverPositionChange={setHoveredNodePosition}
                onNodeSelect={selectNodeConnections}
              />
            ) : (
              <div className="p-6 text-sm text-muted-foreground">No data to display.</div>
            )}
            {contextNode && hoveredNodePosition ? (
              <div
                className="pointer-events-none absolute z-20 max-w-[30rem] rounded-md border bg-background/95 px-3 py-2 text-xs shadow-sm backdrop-blur"
                style={{
                  left: `${hoveredNodePosition.x + 14}px`,
                  top: `${hoveredNodePosition.y + 14}px`,
                }}
              >
                <div className="mb-1 inline-flex items-center gap-2">
                  <Badge variant="outline" className="h-5">
                    Customer
                  </Badge>
                  <span className="font-medium">{contextNode.customer.name || "Unknown"}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
                  <span>Node</span>
                  <span className="font-mono text-[11px] text-foreground">{contextNode.fqdn}</span>
                  {contextNode.customer.cmdb_ci_id ? (
                    <>
                      <span>CMDB</span>
                      <span className="font-mono text-[11px] text-foreground">
                        {contextNode.customer.cmdb_ci_id}
                      </span>
                    </>
                  ) : null}
                </div>
                {primaryInterface ? (
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
                    <span>IP</span>
                    <span className="font-mono text-[11px] text-foreground">{primaryInterface.ip}</span>
                    <span>Subnet</span>
                    <span className="font-mono text-[11px] text-foreground">
                      {primaryInterface.subnet}
                    </span>
                    <span>MAC</span>
                    <span className="font-mono text-[11px] text-foreground">{primaryInterface.mac}</span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="flex min-h-0 flex-col overflow-hidden p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <Input
                  className="h-8 w-56"
                  placeholder={tableView === "nodes" ? "Search nodes..." : "Search connections..."}
                  value={globalSearch}
                  onChange={(event) => setGlobalSearch(event.target.value)}
                />

                {tableView === "nodes" ? (
                  <FilterBar
                    dispatch={dispatchFilters}
                    filters={filters}
                    suggestions={filterSuggestions}
                  />
                ) : (
                  <>
                    <FilterBar
                      dispatch={dispatchFilters}
                      filters={filters}
                      suggestions={filterSuggestions}
                    />
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
                  variant={tableView === "nodes" ? "default" : "ghost"}
                  size="sm"
                  className="h-7"
                  onClick={() => setTableView("nodes")}
                >
                  Nodes
                </Button>
                <Button
                  variant={tableView === "connections" ? "default" : "ghost"}
                  size="sm"
                  className="h-7"
                  onClick={() => setTableView("connections")}
                >
                  Connections
                </Button>
              </div>
            </div>
            {tableView === "nodes" ? (
              selectedNode ? (
                <NodeDetailsPanel
                  node={selectedNode}
                  onBack={() => setSelectedNodeFqdn(null)}
                />
              ) : (
                <DataTable
                  columns={nodeColumns}
                  data={tableNodes}
                  getRowHoverId={(row) => row.fqdn}
                  hoveredRowId={hoveredNodeFqdn}
                  onRowHoverChange={setHoveredNodeFqdn}
                />
              )
            ) : (
              <DataTable
                columns={connectionColumns}
                data={tableConnections}
                getRowHoverId={(row) => row.id}
                hoveredRowIds={hoveredConnectionIds}
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

function NodeDetailsPanel({
  node,
  onBack,
}: {
  node: NonNullable<GraphSnapshot["nodes"][number]>;
  onBack: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto rounded-md border bg-background p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Node Details</h2>
          <p className="font-mono text-xs text-muted-foreground">{node.fqdn}</p>
        </div>
        <Button size="sm" variant="outline" onClick={onBack}>
          Back To Table
        </Button>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Identity
          </h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <InfoItem label="Hostname" value={node.hostname} />
            <InfoItem label="FQDN" value={node.fqdn} mono />
            <InfoItem label="Customer" value={node.customer.name} />
            <InfoItem label="CMDB CI ID" value={node.customer.cmdb_ci_id} mono />
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Activity
          </h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <InfoItem label="# Distinct Edges" value={String(node.distinct_edge)} mono />
            <InfoItem label="# Connections" value={String(node.connection_count)} mono />
            <InfoItem label="First Seen" value={node.first_seen} mono />
            <InfoItem label="Last Seen" value={node.last_seen} mono />
          </div>
        </div>
      </div>

      <div className="mt-5">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Interfaces
        </h3>
        <div className="space-y-2">
          {node.interfaces.map((netInterface, index) => (
            <div
              key={`${netInterface.ip}-${index}`}
              className="rounded-md border bg-muted/20 p-3 text-xs"
            >
              <div className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                Interface {index + 1}
              </div>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                <InfoItem label="IP" value={netInterface.ip} mono />
                <InfoItem label="Subnet" value={netInterface.subnet} mono />
                <InfoItem label="MAC" value={netInterface.mac} mono />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md border bg-muted/15 px-3 py-2">
      <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono text-xs" : "text-sm"}>{value || "-"}</div>
    </div>
  );
}
