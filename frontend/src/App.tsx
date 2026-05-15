import { useCallback, useEffect, useMemo, useState } from 'react';
import GraphView from './components/GraphView'
import brand from "./config/brand";
import type { EdgeDetails, GraphCursor, GraphData, NodeDetails } from './types/graph';
import { applyGraphDelta, fetchGraphDelta, fetchGraphSnapshot } from './api/graphApi';
import NodeDetailsPanel from './components/NodeDetailsPane';
import AppHeader from './components/AppHeader';
import Filters from './components/Filters';
import type { filter } from './types/filter';
import SearchBar from './components/SearchBar';
import { readInitialSelectedNodeId, readInitialFilters, readInitialSearchQuery, refreshIntervalMinutes, serializeFiltersForUrl, SEARCH_QUERY_KEY, FILTERS_QUERY_KEY, SELECTED_NODE_QUERY_KEY, SELECTED_EDGE_QUERY_KEY, readInitialSelectedEdgeId } from './utils/urlStateService';

document.title = brand.name;


function App() {
  const initialSelectedNodeId = readInitialSelectedNodeId();
  const initialSelectedEdgeId = readInitialSelectedEdgeId();

  const [data, setData] = useState<GraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<NodeDetails | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<EdgeDetails | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>(initialSelectedEdgeId);
  const [selectedNodeId, setSelectedNodeId] = useState<string>(initialSelectedNodeId);
  const [filters, setFilters] = useState<filter[]>(() => readInitialFilters());
  const [searchQuery, setSearchQuery] = useState<string>(() => readInitialSearchQuery());
  const [searchSelection, setSearchSelection] = useState<string>(initialSelectedNodeId);
  const [searchSelectionVersion, setSearchSelectionVersion] = useState(initialSelectedNodeId ? 1 : 0);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const [graphCursor, setGraphCursor] = useState<GraphCursor | null>(null);
  const fqdnSuggestions = useMemo(() => {
    if (!data) return [];

    const nodeNames = new Set<string>();

    for (const node of data.nodes) nodeNames.add(node.fqdn);
    for (const edge of data.edges) {
      nodeNames.add(edge.source_fqdn);
      nodeNames.add(edge.target_fqdn);
    }

    return [...nodeNames].sort((a, b) => a.localeCompare(b));
  }, [data]);

  const handleSelectNode = useCallback((node: string, attrs: NodeDetails | null) => {
    setSelectedNode(attrs);
    setSelectedNodeId(attrs ? node : "");
    if (attrs) {
      setSelectedEdge(null);
      setSelectedEdgeId("");
    }
  }, []);

  const handleSelectEdge = useCallback((edge: EdgeDetails | null) => {
    setSelectedEdge(edge);
    setSelectedEdgeId(edge?.id ?? "" );
    if (edge) {
      setSelectedNode(null);
      setSelectedNodeId("");
    }
  }, []);

  const handleSearchSubmit = useCallback((query: string) => {
    if (!query) return;
    setSearchSelection(query);
    setSearchSelectionVersion((version) => version + 1);
  }, []);

  // load graph on initial render
  useEffect(() => {
    let cancelled = false;

    async function loadGraph() {
      const snapshot = await fetchGraphSnapshot();
      if (cancelled) return;
      setData({ nodes: snapshot.nodes, edges: snapshot.edges });
      setGraphCursor(snapshot.cursor);
      setLastFetchedAt(new Date());
    }

    loadGraph();

    return () => {
      cancelled = true;
    };
  }, []);

  // auto fetch graph every n minutes
  useEffect(() => {
    if (!graphCursor) return;
    const currentCursor = graphCursor;

    let active = true;
    let inFlight = false;

    async function refreshGraph() {
      if (inFlight) return;
      inFlight = true;

      try {
        const delta = await fetchGraphDelta(currentCursor);
        if (!active) return;

        setData((currentData) => {
          if (!currentData) {
            return {
              nodes: delta.upsert_nodes,
              edges: delta.upsert_edges,
            };
          }

          return applyGraphDelta(currentData, delta);
        });
        setGraphCursor(delta.cursor);
        setLastFetchedAt(new Date());
      } catch {
        if (!active) return;
        const snapshot = await fetchGraphSnapshot();
        if (!active) return;
        setData({ nodes: snapshot.nodes, edges: snapshot.edges });
        setGraphCursor(snapshot.cursor);
        setLastFetchedAt(new Date());
      } finally {
        inFlight = false;
      }
    }

    const intervalId = window.setInterval(() => {
      refreshGraph();
    }, refreshIntervalMinutes * 60 * 1000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [graphCursor]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (searchQuery.trim()) params.set(SEARCH_QUERY_KEY, searchQuery);
    else params.delete(SEARCH_QUERY_KEY);

    if (filters.length > 0) params.set(FILTERS_QUERY_KEY, serializeFiltersForUrl(filters));
    else params.delete(FILTERS_QUERY_KEY);

    if (selectedNodeId) params.set(SELECTED_NODE_QUERY_KEY, selectedNodeId);
    else params.delete(SELECTED_NODE_QUERY_KEY);

    if (selectedEdgeId) params.set(SELECTED_EDGE_QUERY_KEY, selectedEdgeId);
    else params.delete(SELECTED_EDGE_QUERY_KEY);

    const queryString = params.toString();
    const nextUrl = `${window.location.pathname}${queryString ? `?${queryString}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", nextUrl);
  }, [searchQuery, filters, selectedNodeId, selectedEdgeId]);



  return (
    <main className="app">
      <section className="app-content">
        <div className="graphview-shell">
          {data ? <GraphView data={data} filters={filters} onSelectNode={handleSelectNode} onSelectEdge={handleSelectEdge} selectedEdgeId={selectedEdgeId} searchQuery={searchQuery} searchSelection={searchSelection} searchSelectionVersion={searchSelectionVersion} /> : <p className="graphview-loading">Loading graph...</p>}
        </div>
        <div className="graphview-overlay">
          <AppHeader />
          {(selectedNode || selectedEdge) ? <NodeDetailsPanel node={selectedNode} edge={selectedEdge} filters={filters} searchQuery={searchQuery} /> : null}
          <div className="filter-container">
            <SearchBar query={searchQuery} setQuery={setSearchQuery} suggestions={fqdnSuggestions} onSubmit={handleSearchSubmit} />
            <Filters filters={filters} setFilters={setFilters} fqdnSuggestions={fqdnSuggestions} />
          </div>
          <span className="last-fetch-info">{`Updated at ${lastFetchedAt ? lastFetchedAt.toLocaleTimeString(["sv-se"], { hour: "2-digit", minute: "2-digit" }) : "--:--"}`}</span>
        </div>
      </section>
    </main>
  )
}

export default App
