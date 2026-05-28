import type { GraphEdge, GraphNode, GraphSnapshot, NetInterface } from "./types";

type PlaceholderNodeDraft = {
  fqdn: string;
  interfacesByIp: Map<string, NetInterface>;
  edgeIds: Set<string>;
  connectionCount: number;
  firstSeen: string;
  lastSeen: string;
};

export function normalizeGraphSnapshot(snapshot: GraphSnapshot): GraphSnapshot {
  const apiNodes = snapshot.nodes.filter((node) => !node.is_placeholder);
  const nodesByFqdn = new Map(apiNodes.map((node) => [node.fqdn, node]));
  const placeholdersByFqdn = new Map<string, PlaceholderNodeDraft>();

  for (const edge of snapshot.edges) {
    addMissingEndpoint(placeholdersByFqdn, nodesByFqdn, edge, edge.source_fqdn, edge.source_ip);
    addMissingEndpoint(placeholdersByFqdn, nodesByFqdn, edge, edge.target_fqdn, edge.target_ip);
  }

  return {
    ...snapshot,
    nodes: [...apiNodes, ...[...placeholdersByFqdn.values()].map(toPlaceholderNode)],
  };
}

function addMissingEndpoint(
  placeholdersByFqdn: Map<string, PlaceholderNodeDraft>,
  nodesByFqdn: Map<string, GraphNode>,
  edge: GraphEdge,
  fqdn: string,
  ip: string,
) {
  if (!fqdn || nodesByFqdn.has(fqdn)) {
    return;
  }

  const placeholder = getPlaceholder(placeholdersByFqdn, fqdn, edge);
  const seenCount = Math.max(edge.seen_count ?? 1, 1);

  placeholder.edgeIds.add(edge.id);
  placeholder.connectionCount += seenCount;
  placeholder.firstSeen = minDateString(placeholder.firstSeen, edge.first_seen);
  placeholder.lastSeen = maxDateString(placeholder.lastSeen, edge.last_seen);

  if (ip && !placeholder.interfacesByIp.has(ip)) {
    placeholder.interfacesByIp.set(ip, { ip, mac: "", subnet: "" });
  }
}

function getPlaceholder(
  placeholdersByFqdn: Map<string, PlaceholderNodeDraft>,
  fqdn: string,
  edge: GraphEdge,
) {
  const existing = placeholdersByFqdn.get(fqdn);

  if (existing) {
    return existing;
  }

  const placeholder: PlaceholderNodeDraft = {
    fqdn,
    interfacesByIp: new Map(),
    edgeIds: new Set(),
    connectionCount: 0,
    firstSeen: edge.first_seen,
    lastSeen: edge.last_seen,
  };

  placeholdersByFqdn.set(fqdn, placeholder);

  return placeholder;
}

function toPlaceholderNode(placeholder: PlaceholderNodeDraft): GraphNode {
  return {
    id: `edge:${placeholder.fqdn}`,
    fqdn: placeholder.fqdn,
    hostname: getHostname(placeholder.fqdn),
    interfaces: [...placeholder.interfacesByIp.values()],
    distinct_edge: placeholder.edgeIds.size,
    connection_count: placeholder.connectionCount,
    customer: {
      name: "Unknown",
      cmdb_ci_id: "",
      id: -1,
    },
    first_seen: placeholder.firstSeen,
    last_seen: placeholder.lastSeen,
    is_placeholder: true,
  };
}

function getHostname(fqdn: string) {
  return fqdn.split(".")[0] || fqdn;
}

function minDateString(current: string, next: string) {
  return Date.parse(next) < Date.parse(current) ? next : current;
}

function maxDateString(current: string, next: string) {
  return Date.parse(next) > Date.parse(current) ? next : current;
}
