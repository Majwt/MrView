import { describe, expect, it } from "vitest";
import type { GraphDelta, GraphEdge, GraphNode, GraphSnapshot } from "./types";
import { applyGraphDelta } from "./apply-graph-delta";

function makeNode(fqdn: string, hostname: string): GraphNode {
  return {
    id: fqdn,
    fqdn,
    hostname,
    interfaces: [{ adapter: "eth0", ipv4: "10.0.0.1", subnetv4: "255.255.255.0", ipv6: null, subnetv6: null, mac: "aa" }],
    distinct_edge: 1,
    connection_count: 1,
    x: 0,
    y: 0,
    fx: null,
    fy: null,
  };
}

function makeEdge(id: string, sourceFqdn: string, targetFqdn: string): GraphEdge {
  return {
    id,
    protocol: "TCP",
    service_name: "ssh",
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
    seen_count: 2,
    first_seen: "2026-01-01T00:00:00Z",
    last_seen: "2026-01-03T00:00:00Z",
    source: sourceFqdn,
    target: targetFqdn,
  };
}

describe("applyGraphDelta", () => {
  it("merges node updates, removes deleted edges, and normalizes missing endpoints", () => {
    const current: GraphSnapshot = {
      nodes: [makeNode("alpha.example", "alpha")],
      edges: [makeEdge("e1", "alpha.example", "beta.example")],
      cursor: {
        last_seen: "2026-01-01T00:00:00Z",
        last_seen_edge_id: 1,
        last_seen_node_id: 1,
      },
    };

    const delta: GraphDelta = {
      upsert_nodes: [
        {
          ...makeNode("alpha.example", "alpha-renamed"),
          interfaces: undefined,
          connection_count: 5,
        },
      ],
      upsert_edges: [makeEdge("e2", "alpha.example", "missing-node.example")],
      remove_node_ids: [],
      remove_edge_ids: ["e1"],
      cursor: {
        last_seen: "2026-01-05T00:00:00Z",
        last_seen_edge_id: 2,
        last_seen_node_id: 1,
      },
    };

    const result = applyGraphDelta(current, delta);
    const alpha = result.nodes.find((node) => node.fqdn === "alpha.example");
    const placeholder = result.nodes.find((node) => node.fqdn === "missing-node.example");

    expect(result.cursor).toEqual(delta.cursor);
    expect(result.edges.map((edge) => edge.id)).toEqual(["e2"]);
    expect(alpha?.hostname).toBe("alpha-renamed");
    expect(alpha?.connection_count).toBe(5);
    expect(alpha?.interfaces).toHaveLength(1);
    expect(placeholder?.is_placeholder).toBe(true);
  });
});
