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
  const edges = combineAnonymousEndpointsByNeighbor(snapshot.edges, nodesByFqdn);
  const placeholdersByFqdn = new Map<string, PlaceholderNodeDraft>();

  for (const edge of edges) {
    addMissingEndpoint(placeholdersByFqdn, nodesByFqdn, edge, edge.source_fqdn, edge.source_ip);
    addMissingEndpoint(placeholdersByFqdn, nodesByFqdn, edge, edge.target_fqdn, edge.target_ip);
  }

  for (const edge of snapshot.edges) {
    edge.source = edge.source_fqdn;
    edge.target = edge.target_fqdn;
  }

  return {
    ...snapshot,
    edges,
    nodes: [...apiNodes, ...[...placeholdersByFqdn.values()].map(toPlaceholderNode)],
  };
}

function combineAnonymousEndpointsByNeighbor(
  edges: GraphEdge[],
  nodesByFqdn: Map<string, GraphNode>,
) {
  const knownFqdnByNeighborAndIp = new Map<string, string>();

  for (const edge of edges) {
    addKnownEndpoint(knownFqdnByNeighborAndIp, nodesByFqdn, {
      endpointFqdn: edge.source_fqdn,
      endpointIp: edge.source_ip,
      neighborFqdn: edge.target_fqdn,
    });
    addKnownEndpoint(knownFqdnByNeighborAndIp, nodesByFqdn, {
      endpointFqdn: edge.target_fqdn,
      endpointIp: edge.target_ip,
      neighborFqdn: edge.source_fqdn,
    });
  }

  return edges.map((edge) => {
    const sourceFqdn = getCombinedEndpointFqdn(knownFqdnByNeighborAndIp, {
      endpointFqdn: edge.source_fqdn,
      endpointIp: edge.source_ip,
      neighborFqdn: edge.target_fqdn,
    });
    const targetFqdn = getCombinedEndpointFqdn(knownFqdnByNeighborAndIp, {
      endpointFqdn: edge.target_fqdn,
      endpointIp: edge.target_ip,
      neighborFqdn: sourceFqdn,
    });

    if (sourceFqdn === edge.source_fqdn && targetFqdn === edge.target_fqdn) {
      return edge;
    }

    return {
      ...edge,
      source_fqdn: sourceFqdn,
      target_fqdn: targetFqdn,
    };
  });
}

function addKnownEndpoint(
  knownFqdnByNeighborAndIp: Map<string, string>,
  nodesByFqdn: Map<string, GraphNode>,
  endpoint: { endpointFqdn: string; endpointIp: string; neighborFqdn: string },
) {
  if (
    !endpoint.endpointIp ||
    !endpoint.neighborFqdn ||
    isAnonymousEndpoint(endpoint.endpointFqdn, endpoint.endpointIp) ||
    !nodesByFqdn.has(endpoint.endpointFqdn)
  ) {
    return;
  }

  const key = getNeighborIpKey(endpoint.neighborFqdn, endpoint.endpointIp);

  if (!knownFqdnByNeighborAndIp.has(key)) {
    knownFqdnByNeighborAndIp.set(key, endpoint.endpointFqdn);
  }
}

function getCombinedEndpointFqdn(
  knownFqdnByNeighborAndIp: Map<string, string>,
  endpoint: { endpointFqdn: string; endpointIp: string; neighborFqdn: string },
) {
  if (
    !endpoint.endpointIp ||
    !endpoint.neighborFqdn ||
    !isAnonymousEndpoint(endpoint.endpointFqdn, endpoint.endpointIp)
  ) {
    return endpoint.endpointFqdn;
  }

  return (
    knownFqdnByNeighborAndIp.get(getNeighborIpKey(endpoint.neighborFqdn, endpoint.endpointIp)) ??
    endpoint.endpointFqdn
  );
}

function isAnonymousEndpoint(fqdn: string, ip: string) {
  return !fqdn || fqdn === ip || isIpv4(fqdn);
}

function isIpv4(value: string) {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(value);
}

function getNeighborIpKey(neighborFqdn: string, ip: string) {
  return `${neighborFqdn}::${ip}`;
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
    placeholder.interfacesByIp.set(ip, { adapter: "Unknown", ip, mac: "", subnet: "" });
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
    hostname: isIpv4(placeholder.fqdn) ? placeholder.fqdn : getHostname(placeholder.fqdn),
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
    x: Math.random() * 1000,
    y: Math.random() * 1000,
    fx: null,
    fy: null,
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
