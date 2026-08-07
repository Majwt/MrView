import { describe, expect, it } from "vitest";
import type { GraphEdge, GraphNode, GraphSnapshot } from "@/features/graph/types";
import { applyGlobalSearch } from "./apply-global-search";

function makeNode(fqdn: string, hostname: string): GraphNode {
  return {
    id: fqdn,
    fqdn,
    hostname,
    distinct_edge: 1,
    connection_count: 1,
    x: 0,
    y: 0,
    fx: null,
    fy: null,
  };
}

function makeEdge(id: string, sourceFqdn: string, targetFqdn: string, serviceName: string): GraphEdge {
  return {
    id,
    protocol: "TCP",
    service_name: serviceName,
    source_ip: "10.0.0.1",
    source_port: 5000,
    source_fqdn: sourceFqdn,
    source_pid: null,
    source_process_name: null,
    target_ip: "10.0.0.2",
    target_port: 22,
    target_fqdn: targetFqdn,
    target_pid: null,
    target_process_name: null,
    seen_count: 3,
    first_seen: "2026-01-01T00:00:00Z",
    last_seen: "2026-01-02T00:00:00Z",
    source: sourceFqdn,
    target: targetFqdn,
  };
}

function makeGraph(): GraphSnapshot {
  return {
    nodes: [
      makeNode("alpha.example", "alpha"),
      makeNode("beta.example", "beta"),
      makeNode("gamma.example", "gamma"),
    ],
    edges: [
      makeEdge("e1", "alpha.example", "beta.example", "ssh"),
      makeEdge("e2", "alpha.example", "gamma.example", "http"),
    ],
    cursor: {
      last_seen: "2026-01-02T00:00:00Z",
      last_seen_edge_id: 2,
      last_seen_node_id: 3,
    },
  };
}

describe("applyGlobalSearch", () => {
  it("returns original graph when query is empty", () => {
    const graph = makeGraph();

    const result = applyGlobalSearch(graph, "  ", "node");

    expect(result).toBe(graph);
  });

  it("filters connection results by edge fields and keeps connected nodes", () => {
    const graph = makeGraph();

    const result = applyGlobalSearch(graph, "ssh", "connection");

    expect(result).not.toBeNull();
    expect(result?.edges.map((edge) => edge.id)).toEqual(["e1"]);
    expect(result?.nodes.map((node) => node.fqdn).sort()).toEqual([
      "alpha.example",
      "beta.example",
    ]);
  });

  it("filters node results by node fields and removes edges with hidden endpoints", () => {
    const graph = makeGraph();

    const result = applyGlobalSearch(graph, "gamma", "node");

    expect(result).not.toBeNull();
    expect(result?.nodes.map((node) => node.fqdn)).toEqual(["gamma.example"]);
    expect(result?.edges).toEqual([]);
  });
});
