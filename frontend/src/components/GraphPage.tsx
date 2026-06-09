import { fetchGraphSnapshot, fetchGraphDelta } from "@/api/graph-api";
import { applyGlobalSearch } from "@/features/filters/apply-global-search";
import { applyGraphFilters } from "@/features/filters/apply-graph-filters";
import { buildFilterSuggestions } from "@/features/filters/filter-suggestions";
import { filtersReducer } from "@/features/filters/filters-reducer";
import { applyGraphDelta } from "@/features/graph/apply-graph-delta";
import { normalizeGraphSnapshot } from "@/features/graph/normalize-graph-snapshot";
import type { GraphSnapshot } from "@/features/graph/types";
import { readUrlState, type TableView, writeUrlState } from "@/features/url-state";
import { Badge, X } from "lucide-react";
import { useEffect, useMemo, useReducer, useState } from "react";
import FilterBar from "./FilterBar";
import GraphViewD3 from "./GraphViewD3";
import NodeDetailsPanel from "./NodeDetailsPanel";
import { type TableConnection, connectionColumns } from "./table/connection-columns";
import { DataTable } from "./table/data-table";
import { type TableNode, nodeColumns } from "./table/node-columns";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useParams } from "react-router";


const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 1 minutes


export default function GraphPage() {

  const {customerId} = useParams();


  const [initialUrlState] = useState(readUrlState);
  const [snapshot, setSnapshot] = useState<GraphSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tableView, setTableView] = useState<TableView>(initialUrlState.tableView);
  const [selectedNodeFqdn, setSelectedNodeFqdn] = useState<string | null>(
    initialUrlState.selectedNodeFqdn,
  );
  const [hoveredNodeFqdn, setHoveredNodeFqdn] = useState<string | null>(null);
  const [hoveredNodePosition, setHoveredNodePosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [hoveredConnectionIds, setHoveredConnectionIds] = useState<Set<string>>(() => new Set());
  const [globalSearch, setGlobalSearch] = useState(initialUrlState.globalSearch);

  const [filters, dispatchFilters] = useReducer(filtersReducer, initialUrlState.filters);
  const filterSuggestions = useMemo(() => buildFilterSuggestions(snapshot), [snapshot]);

  const nodeFilteredSnapshot = useMemo(() => {
    if (!snapshot) return null;

    return applyGraphFilters(snapshot, filters);
  }, [snapshot, filters]);
  const nodeSearchedSnapshot = useMemo(
    () => applyGlobalSearch(nodeFilteredSnapshot, globalSearch, "node"),
    [nodeFilteredSnapshot, globalSearch],
  );

  const connectionFilteredSnapshot = useMemo(() => {
    if (!snapshot) return null;

    return applyGraphFilters(snapshot, filters);
  }, [snapshot, filters]);
  const connectionSearchedSnapshot = useMemo(
    () => applyGlobalSearch(connectionFilteredSnapshot, globalSearch, "connection"),
    [connectionFilteredSnapshot, globalSearch],
  );

  const graphSnapshot = tableView === "nodes" ? nodeSearchedSnapshot : connectionSearchedSnapshot;

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
    if (connectionSearchedSnapshot == null) return [];

    const edges = selectedNodeFqdn
      ? connectionSearchedSnapshot.edges.filter(
        (edge) =>
          edge.source_fqdn === selectedNodeFqdn || edge.target_fqdn === selectedNodeFqdn,
      )
      : connectionSearchedSnapshot.edges;

    return edges.map((edge) => ({
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
  }, [connectionSearchedSnapshot, selectedNodeFqdn]);

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

        const data = await fetchGraphSnapshot(customerId ? Number(customerId) : null);
        console.log("Fetched graph snapshot");

        const snapshot = normalizeGraphSnapshot({
          nodes: data.upsert_nodes,
          edges: data.upsert_edges,
          cursor: data.cursor,
        });
        console.log("Normalized graph snapshot");

        setSnapshot(snapshot);
      } catch (error) {
        setError(error instanceof Error ? error.message : "Failed to load graph");
      } finally {
        setIsLoading(false);
      }
    }

    loadGraph();
  }, [customerId]);

  useEffect(() => {
    writeUrlState({
      filters,
      globalSearch,
      selectedNodeFqdn,
      tableView,
    });
  }, [filters, globalSearch, selectedNodeFqdn, tableView]);

  useEffect(() => {
    function syncStateFromUrl() {
      const urlState = readUrlState();

      setTableView(urlState.tableView);
      setSelectedNodeFqdn(urlState.selectedNodeFqdn);
      setGlobalSearch(urlState.globalSearch);
      dispatchFilters({ type: "replaceRules", rules: urlState.filters.rules });
    }

    window.addEventListener("popstate", syncStateFromUrl);

    return () => {
      window.removeEventListener("popstate", syncStateFromUrl);
    };
  }, []);

  // Delta refresh every 5 minutes
  useEffect(() => {
    if (!snapshot?.cursor) return;

    const intervalId = window.setInterval(async () => {
      try {
        const delta = await fetchGraphDelta(snapshot.cursor, customerId ? Number(customerId) : null);

        setSnapshot((current) => {
          if (!current) return current;

          const newData = applyGraphDelta(current, delta);
          return newData;
        });
      } catch (error) {
        console.error("Failed to fetch graph delta", error);
      }
    }, REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [snapshot]);

  const isLoadingDiv = () => {
    return <div className="p-6 text-sm text-muted-foreground">Loading graph...</div>;
  }

  const errorDiv = () => {
    return <div className="p-6 text-sm text-destructive">{error}</div>;
  }

  return (
    <>
      {error || isLoading ? (
        <>
          {error && errorDiv()}
          {isLoading && isLoadingDiv()}
        </>
      ) : (
        <>

          <section className="relative min-h-0 border-b">
            {snapshot ? (
              <GraphViewD3
                graphData={snapshot}
                visibleEdgeIds={visibleEdgeIds}
                visibleNodeIds={visibleNodeIds}
                hoveredEdgeIds={hoveredConnectionIds}
                hoveredNodeId={hoveredNodeFqdn}
                selectedNodeId={selectedNodeFqdn}
                onEdgeHoverChange={(edgeIds) => setHoveredConnectionIds(new Set(edgeIds))}
                onNodeHoverChange={setHoveredNodeFqdn}
                onNodeHoverPositionChange={setHoveredNodePosition}
                onNodeSelect={selectNodeConnections}
                onStageClick={() => setSelectedNodeFqdn(null)}
              />
            ) : (
              <div className="p-6 text-sm text-muted-foreground">No data to display.</div>
            )}
            {contextNode && hoveredNodePosition ? (
              <div
                className="pointer-events-none absolute z-20 max-w-120 rounded-md border bg-background/95 px-3 py-2 text-xs shadow-sm backdrop-blur"
                style={{
                  left: `${hoveredNodePosition.x + 14}px`,
                  top: `${hoveredNodePosition.y + 14}px`,
                }}
              >
                <div className="mb-1 inline-flex items-center gap-2">
                  <Badge variant="outline" className="h-5">
                    Owner
                  </Badge>
                  <span className="font-medium">{contextNode.customer.name || "Unknown"}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
                  <span>Node</span>
                  <span className="font-mono text-[11px] text-foreground">{contextNode.fqdn}</span>
                  {contextNode.customer.cmdb_ci_id ? (
                    <>
                      <span>CmdbCiId</span>
                      <span className="font-mono text-[11px] text-foreground">
                        {contextNode.customer.cmdb_ci_id}
                      </span>
                    </>
                  ) : null}
                </div>
                {contextNode.interfaces.map((intf) => (

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
                    <span>IP</span>
                    <span className="font-mono text-[11px] text-foreground">{intf.ip}</span>
                    <span>Subnet</span>
                    <span className="font-mono text-[11px] text-foreground">
                      {intf.subnet}
                    </span>
                    <span>MAC</span>
                    <span className="font-mono text-[11px] text-foreground">{intf.mac}</span>
                  </div>
                ))}

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

        </>
      )}

    </>
  )
}
