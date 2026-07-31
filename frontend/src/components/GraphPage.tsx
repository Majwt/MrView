import { fetchGraphSnapshot, fetchGraphDelta, fetchNodeDetails, fetchFilteredCiids, type GraphQueryParams, type NodeFilterParams } from "@/api/graph-api";
import { applyGlobalSearch } from "@/features/filters/apply-global-search";
import { applyGraphFilters } from "@/features/filters/apply-graph-filters";
import { buildFilterSuggestions } from "@/features/filters/filter-suggestions";
import { filtersReducer } from "@/features/filters/filters-reducer";
import { applyGraphDelta } from "@/features/graph/apply-graph-delta";
import { normalizeGraphSnapshot } from "@/features/graph/normalize-graph-snapshot";
import type { GraphSnapshot } from "@/features/graph/types";
import { readUrlState, writeUrlState } from "@/features/url-state";
import { X } from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useTransition } from "react";
import FilterBar from "./FilterBar";
import GraphQuickFilters, { type QuickFilters } from "./GraphQuickFilters";
import GraphViewD3 from "./GraphViewD3";
import NodeDetailsPanel from "./NodeDetailsPanel";
import { type TableConnection, connectionColumns } from "./table/connection-columns";
import { DataTable } from "./table/data-table";

import { Input } from "./ui/input";
import { useParams } from "react-router";
import { useGraphStats } from "@/features/graph/GraphStatsContext";


const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 1 minutes


export default function GraphPage() {

  const { customerId } = useParams();
  const { setLastConnectionUtc } = useGraphStats();


  const [initialUrlState] = useState(readUrlState);
  const [snapshot, setSnapshot] = useState<GraphSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeFqdn, setSelectedNodeFqdn] = useState<string | null>(
    initialUrlState.selectedNodeFqdn,
  );
  const [hoveredNodeFqdn, setHoveredNodeFqdn] = useState<string | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const handleHoverPositionChange = useCallback((pos: { x: number; y: number } | null) => {
    if (!tooltipRef.current) return;
    if (pos) {
      tooltipRef.current.style.left = `${pos.x + 14}px`;
      tooltipRef.current.style.top = `${pos.y + 14}px`;
      tooltipRef.current.style.display = "";
    } else {
      tooltipRef.current.style.display = "none";
    }
  }, []);
  const [hoveredConnectionIds, setHoveredConnectionIds] = useState<Set<string>>(() => new Set());
  const [globalSearch, setGlobalSearch] = useState(initialUrlState.globalSearch);
  const [quickFilters, setQuickFilters] = useState<QuickFilters>({
    hideIsolatedNodes: true,
    staleThresholdHours: null,
  });

  const [isLoadingNodeDetails, setIsLoadingNodeDetails] = useState(false);
  const nodeDetailsCacheRef = useRef(new Map<string, object>());
  const snapshotRef = useRef(snapshot);
  useEffect(() => { snapshotRef.current = snapshot; }, [snapshot]);
  const quickFiltersRef = useRef(quickFilters);
  useEffect(() => { quickFiltersRef.current = quickFilters; }, [quickFilters]);

  const [serverFilteredCiids, setServerFilteredCiids] = useState<Set<string> | null>(null);

  const [, startTransition] = useTransition();
  const [filters, dispatchFilters] = useReducer(filtersReducer, initialUrlState.filters);
  const filterSuggestions = useMemo(() => buildFilterSuggestions(snapshot), [snapshot]);

  const connectionFilteredSnapshot = useMemo(() => {
    if (!snapshot) return null;
    let filtered = snapshot;

    // Apply server-side ciid allowlist (ip/mac/customer/date filters)
    if (serverFilteredCiids !== null) {
      const allowedFqdns = new Set(
        filtered.nodes
          .filter((n) => n.is_placeholder || (n.ciid && serverFilteredCiids.has(n.ciid)))
          .map((n) => n.fqdn),
      );
      filtered = {
        ...filtered,
        nodes: filtered.nodes.filter((n) => allowedFqdns.has(n.fqdn)),
        edges: filtered.edges.filter(
          (e) => allowedFqdns.has(e.source_fqdn) && allowedFqdns.has(e.target_fqdn),
        ),
      };
    }

    return applyGraphFilters(filtered, filters);
  }, [snapshot, filters, serverFilteredCiids]);
  const connectionSearchedSnapshot = useMemo(
    () => applyGlobalSearch(connectionFilteredSnapshot, globalSearch, "connection"),
    [connectionFilteredSnapshot, globalSearch],
  );

  // Quick filters are now server-side — just pass through
  const graphSnapshot = connectionSearchedSnapshot;

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
  const contextNode = hoveredNodeFqdn ? nodesByFqdn.get(hoveredNodeFqdn) : undefined;

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

        const qf = quickFiltersRef.current;
        const graphQueryParams: GraphQueryParams = {
          excludeIsolated: qf.hideIsolatedNodes,
          minLastSeenHours: qf.staleThresholdHours,
        };

        const data = await fetchGraphSnapshot(customerId ? Number(customerId) : null, graphQueryParams);
        console.log("Fetched graph snapshot");

        const snap = normalizeGraphSnapshot({
          nodes: data.upsert_nodes,
          edges: data.upsert_edges,
          cursor: data.cursor,
        });
        console.log("Normalized graph snapshot");

        setSnapshot(snap);
        if (snap.cursor?.last_seen) setLastConnectionUtc(snap.cursor.last_seen);
      } catch (error) {
        setError(error instanceof Error ? error.message : "Failed to load graph");
      } finally {
        setIsLoading(false);
      }
    }

    setSnapshot(null);
    loadGraph();
  }, [customerId]); // eslint-disable-line react-hooks/exhaustive-deps

  // When quick filters change after the initial load, apply as a delta (preserves node positions)
  useEffect(() => {
    if (!snapshotRef.current) return; // Skip during initial load; the load effect handles it

    async function applyFilterChange() {
      try {
        const data = await fetchGraphSnapshot(customerId ? Number(customerId) : null, {
          excludeIsolated: quickFilters.hideIsolatedNodes,
          minLastSeenHours: quickFilters.staleThresholdHours,
        });

        setSnapshot((current) => {
          if (!current) return current;

          const newFqdns = new Set(data.upsert_nodes.map((n: { fqdn: string }) => n.fqdn));
          const removedFqdns = new Set(
            current.nodes
              .filter((n) => !n.is_placeholder && !newFqdns.has(n.fqdn))
              .map((n) => n.fqdn),
          );
          const removeEdgeIds = current.edges
            .filter((e) => removedFqdns.has(e.source_fqdn) || removedFqdns.has(e.target_fqdn))
            .map((e) => e.id);

          return applyGraphDelta(current, {
            cursor: data.cursor,
            upsert_nodes: data.upsert_nodes,
            upsert_edges: data.upsert_edges,
            remove_node_ids: [...removedFqdns],
            remove_edge_ids: removeEdgeIds,
          });
        });
      } catch (error) {
        console.error("Failed to apply filter change", error);
      }
    }

    applyFilterChange();
  }, [quickFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    writeUrlState({
      filters,
      globalSearch,
      selectedNodeFqdn,
      tableView: "connections",
    });
  }, [filters, globalSearch, selectedNodeFqdn]);

  useEffect(() => {
    function syncStateFromUrl() {
      const urlState = readUrlState();

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

    const graphQueryParams: GraphQueryParams = {
      excludeIsolated: quickFilters.hideIsolatedNodes,
      minLastSeenHours: quickFilters.staleThresholdHours,
    };

    const intervalId = window.setInterval(async () => {
      try {
        const delta = await fetchGraphDelta(snapshot.cursor, customerId ? Number(customerId) : null, graphQueryParams);

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
  }, [customerId, snapshot, quickFilters]);

  // Shared helper: fetch and merge node details into snapshot (fire-and-forget)
  const prefetchNodeDetails = useCallback((fqdn: string) => {
    const current = snapshotRef.current;
    if (!current) return;
    const node = current.nodes.find((n) => n.fqdn === fqdn);
    if (!node || node.is_placeholder || !node.ciid || node.customer !== undefined) return;
    const ciid = node.ciid;
    const cached = nodeDetailsCacheRef.current.get(ciid);
    if (cached) {
      setSnapshot((s) =>
        s ? { ...s, nodes: s.nodes.map((n) => (n.fqdn === fqdn ? { ...n, ...cached } : n)) } : s,
      );
      return;
    }
    fetchNodeDetails(ciid)
      .then((details) => {
        nodeDetailsCacheRef.current.set(ciid, details);
        setSnapshot((s) =>
          s ? { ...s, nodes: s.nodes.map((n) => (n.fqdn === fqdn ? { ...n, ...details } : n)) } : s,
        );
      })
      .catch((err) => console.error("Failed to fetch node details", err));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Lazy-load node details when a managed node is selected (also drives the loading indicator)
  useEffect(() => {
    if (!selectedNodeFqdn) return;
    const current = snapshotRef.current;
    if (!current) return;
    const node = current.nodes.find((n) => n.fqdn === selectedNodeFqdn);
    if (!node || node.is_placeholder || !node.ciid || node.customer !== undefined) return;
    const ciid = node.ciid;
    const cached = nodeDetailsCacheRef.current.get(ciid);
    if (cached) {
      setSnapshot((s) =>
        s ? { ...s, nodes: s.nodes.map((n) => (n.fqdn === selectedNodeFqdn ? { ...n, ...cached } : n)) } : s,
      );
      return;
    }
    setIsLoadingNodeDetails(true);
    fetchNodeDetails(ciid)
      .then((details) => {
        nodeDetailsCacheRef.current.set(ciid, details);
        setSnapshot((s) =>
          s ? { ...s, nodes: s.nodes.map((n) => (n.fqdn === selectedNodeFqdn ? { ...n, ...details } : n)) } : s,
        );
      })
      .catch((err) => console.error("Failed to fetch node details", err))
      .finally(() => setIsLoadingNodeDetails(false));
  }, [selectedNodeFqdn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-fetch details on hover so the tooltip can show ciid immediately
  useEffect(() => {
    if (hoveredNodeFqdn) prefetchNodeDetails(hoveredNodeFqdn);
  }, [hoveredNodeFqdn, prefetchNodeDetails]);

  // Server-side attribute filters (ip, mac, customer, first_seen, last_seen)
  const SERVER_SIDE_FIELDS = useMemo(() => new Set(["ip", "mac", "customer", "first_seen", "last_seen"]), []);
  useEffect(() => {
    const serverRules = filters.rules.filter(
      (r) => SERVER_SIDE_FIELDS.has(r.field) && r.value != null && String(r.value).trim() !== "",
    );

    if (serverRules.length === 0) {
      setServerFilteredCiids(null);
      return;
    }

    const params: NodeFilterParams = {};
    for (const rule of serverRules) {
      const val = String(rule.value).trim();
      if (!val) continue;
      if (rule.field === "customer") params.customer ??= val;
      else if (rule.field === "ip") params.ip ??= val;
      else if (rule.field === "mac") params.mac ??= val;
      else if (rule.field === "first_seen") {
        if (rule.operator === "greaterThan" || rule.operator === "is") params.firstSeenAfter ??= val;
        if (rule.operator === "lessThan" || rule.operator === "is") params.firstSeenBefore ??= val;
      } else if (rule.field === "last_seen") {
        if (rule.operator === "greaterThan" || rule.operator === "is") params.lastSeenAfter ??= val;
        if (rule.operator === "lessThan" || rule.operator === "is") params.lastSeenBefore ??= val;
      }
    }

    fetchFilteredCiids(params)
      .then((ciids) => setServerFilteredCiids(new Set(ciids)))
      .catch((err) => console.error("Failed to fetch filtered ciids", err));
  }, [filters, SERVER_SIDE_FIELDS]);

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

          <section className="relative flex min-h-0 border-b">
            <div className="relative flex-1 min-h-0">
              <GraphQuickFilters
                quickFilters={quickFilters}
                onToggleIsolated={() =>
                  setQuickFilters((prev) => ({ ...prev, hideIsolatedNodes: !prev.hideIsolatedNodes }))
                }
                onSetStaleThreshold={(days) =>
                  setQuickFilters((prev) => ({ ...prev, staleThresholdHours: days }))
                }
              />
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
                  onNodeHoverPositionChange={handleHoverPositionChange}
                  onNodeSelect={selectNodeConnections}
                  onStageClick={() => startTransition(() => setSelectedNodeFqdn(null))}
                />
              ) : (
                <div className="p-6 text-sm text-muted-foreground">No data to display.</div>
              )}
              <div
                ref={tooltipRef}
                className="pointer-events-none absolute z-20 max-w-120 rounded-md border bg-background/95 px-3 py-2 text-xs shadow-sm backdrop-blur"
                style={{ display: "none", left: 0, top: 0 }}
              >
                {contextNode ? (<>
                  <div className="mb-1 inline-flex items-center gap-2">
                    <span className="border-2 rounded-md p-1 font-medium">{contextNode.customer?.name || "Unknown"}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
                    <span>Node</span>
                    <span className="font-mono text-[11px] text-foreground">{contextNode.fqdn}</span>
                    {contextNode.customer?.cmdb_ci_id ? (
                      <>
                        <span>CmdbCiId</span>
                        <span className="font-mono text-[11px] text-foreground">
                          {contextNode.customer.cmdb_ci_id}
                        </span>
                      </>
                    ) : null}
                  </div>
                  {(contextNode.interfaces ?? []).map((intf) => (
                    <div key={intf.ip} className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
                      <span>IP</span>
                      <span className="font-mono text-[11px] text-foreground">{intf.ip}</span>
                      {intf.subnet && (
                        <>
                          <span>Subnet</span>
                          <span className="font-mono text-[11px] text-foreground">
                            {intf.subnet}
                          </span>
                        </>
                      )}
                      {intf.mac && (
                        <>
                          <span>MAC</span>
                          <span className="font-mono text-[11px] text-foreground">{intf.mac}</span>
                        </>
                      )}
                      {intf.status && (
                        <>
                          <span>Status</span>
                          <span className="font-mono text-[11px] text-foreground">{intf.status}</span>
                        </>
                      )}
                    </div>
                  ))}
                </>) : null}
              </div>
            </div>
            <aside className="w-110 shrink-0 border-l overflow-y-auto">
              {selectedNode ? (
                <NodeDetailsPanel
                  node={selectedNode}
                  isLoadingDetails={isLoadingNodeDetails}
                  onBack={() => startTransition(() => setSelectedNodeFqdn(null))}
                />
              ) : (
                <div className="p-4 text-sm text-muted-foreground">Select a node to view details.</div>
              )}
            </aside>
          </section>

          <section className="flex min-h-0 flex-col overflow-hidden p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Input
                className="h-8 w-56"
                placeholder="Search connections..."
                value={globalSearch}
                onChange={(event) => setGlobalSearch(event.target.value)}
              />
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
                    onClick={() => startTransition(() => setSelectedNodeFqdn(null))}
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ) : null}
            </div>
            <DataTable
              columns={connectionColumns}
              data={tableConnections}
              getRowHoverId={(row) => row.id}
              hoveredRowIds={hoveredConnectionIds}
              onRowHoverChange={setHoveredConnectionId}
            />
          </section>

        </>
      )}

    </>
  )
}
