import { SidebarInset, SidebarProvider, SidebarTrigger } from "./components/ui/sidebar";
import { AppSidebar } from "./components/AppSidebar";
import GraphView from "./components/GraphView";
import { DataTable } from "@/components/table/data-table";
import { nodeColumns, type TableNode } from "@/components/table/node-columns";
import { useEffect, useMemo, useState } from "react";
import type { GraphSnapshot } from "./features/graph/types";
import { fetchGraphDelta, fetchGraphSnapshot } from "./api/graph-api";
import { applyGraphDelta } from "./features/graph/apply-graph-delta";
import { applyConnectionFiltersToSnapshot } from "./features/connections/apply-filters";
import type { ConnectionFilter } from "./features/connections/filter-types";

const REFRESH_INTERVAL_MS = 1 * 60 * 1000; // 1 minutes

export function App() {
  const [snapshot, setSnapshot] = useState<GraphSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<ConnectionFilter[]>([]);

  const filteredSnapshot = useMemo(() => {
    if (!snapshot) return null;

    return applyConnectionFiltersToSnapshot(snapshot, filters);
  }, [snapshot, filters]);

  const tableNodes: TableNode[] = useMemo(() => {
    if (filteredSnapshot == null) return [];

    const tableNodes = filteredSnapshot.nodes.map((node) => {
      const tableNode: TableNode = {
        id: node.id,
        fqdn: node.fqdn,
        ipv4: node.interfaces[0].ip,
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
            {filteredSnapshot ? (
              <GraphView edges={filteredSnapshot.edges} nodes={filteredSnapshot.nodes} />
            ) : (
              <div className="p-6 text-sm text-muted-foreground">No data to display.</div>
            )}
          </section>

          <section className="min-h-0 overflow-hidden p-4">
            <DataTable columns={nodeColumns} data={tableNodes} />
          </section>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default App;
