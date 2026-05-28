import { SidebarInset, SidebarProvider, SidebarTrigger } from "./components/ui/sidebar";
import { AppSidebar } from "./components/AppSidebar";
import GraphView from "./components/GraphView";
import { DataTable } from "@/components/table/data-table";
import { nodeColumns, type TableNode } from "@/components/table/node-columns";
import { useEffect, useMemo, useReducer, useState } from "react";
import type { GraphSnapshot } from "./features/graph/types";
import { fetchGraphDelta, fetchGraphSnapshot } from "./api/graph-api";
import { applyGraphDelta } from "./features/graph/apply-graph-delta";
import FilterBar from "./components/FilterBar";
import { filtersReducer, initialFilters } from "./features/filters/filters-reducer";
import { applyGraphFilters } from "./features/filters/apply-graph-filters";

const REFRESH_INTERVAL_MS = 1 * 60 * 1000; // 1 minutes

export function App() {
  const [snapshot, setSnapshot] = useState<GraphSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, dispatchFilters] = useReducer(
    filtersReducer,
    initialFilters,
  );

  const filteredSnapshot = useMemo(() => {
    if (!snapshot) return null;

    return applyGraphFilters(snapshot, filters);
  }, [snapshot, filters]);

  const visibleNodeIds = useMemo(
    () => new Set(filteredSnapshot?.nodes.map((node) => node.fqdn) ?? []),
    [filteredSnapshot],
  );

  const visibleEdgeIds = useMemo(
    () => new Set(filteredSnapshot?.edges.map((edge) => edge.id) ?? []),
    [filteredSnapshot],
  );

  const tableNodes: TableNode[] = useMemo(() => {
    if (filteredSnapshot == null) return [];

    const tableNodes = filteredSnapshot.nodes.map((node) => {
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
  }, [filteredSnapshot]);

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
              />
            ) : (
              <div className="p-6 text-sm text-muted-foreground">No data to display.</div>
            )}
          </section>

          <section className="min-h-0 overflow-hidden p-4">

            <FilterBar dispatch={dispatchFilters} filters={filters} />
            <DataTable columns={nodeColumns} data={tableNodes} />
          </section>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default App;
