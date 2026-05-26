import type { GraphData, GraphNode } from "../types/graph";

type FqdnCandidate = {
  fqdn: string;
  fromNode: boolean;
  order: number;
};

function addCandidate(
  candidatesByIp: Map<string, FqdnCandidate[]>,
  ip: string,
  fqdn: string,
  fromNode: boolean,
  order: number,
) {
  if (!ip || !fqdn) return;
  let candidates = candidatesByIp.get(ip);
  if (!candidates) {
    candidates = [];
    candidatesByIp.set(ip, candidates);
  }
  if (candidates.some((candidate) => candidate.fqdn === fqdn)) return;
  candidates.push({ fqdn, fromNode, order });
}

function chooseCanonicalFqdn(ip: string, candidates: FqdnCandidate[]): string {
  const preferred = candidates.filter((candidate) => candidate.fqdn !== ip);
  const pool = preferred.length > 0 ? preferred : candidates;
  const sorted = [...pool].sort((a, b) =>
    Number(b.fromNode) - Number(a.fromNode)
    || a.order - b.order
    || a.fqdn.localeCompare(b.fqdn)
  );
  return sorted[0]?.fqdn ?? ip;
}

function mergeNodes(primary: GraphNode, secondary: GraphNode): GraphNode {
  return {
    fqdn: primary.fqdn,
    ip: primary.ip || secondary.ip,
    subnet: primary.subnet ?? secondary.subnet,
    mac_address: primary.mac_address ?? secondary.mac_address,
    customer: primary.customer ?? secondary.customer,
  };
}

export function normalizeGraphData(data: GraphData): GraphData {
  const candidatesByIp = new Map<string, FqdnCandidate[]>();
  let order = 0;

  for (const node of data.nodes) {
    addCandidate(candidatesByIp, node.ip, node.fqdn, true, order++);
  }
  for (const edge of data.edges) {
    addCandidate(candidatesByIp, edge.source_ip, edge.source_fqdn, false, order++);
    addCandidate(candidatesByIp, edge.target_ip, edge.target_fqdn, false, order++);
  }

  const canonicalByFqdn = new Map<string, string>();
  for (const [ip, candidates] of candidatesByIp) {
    if (candidates.length <= 1) {
      if (candidates[0]) canonicalByFqdn.set(candidates[0].fqdn, candidates[0].fqdn);
      continue;
    }
    const canonical = chooseCanonicalFqdn(ip, candidates);
    for (const candidate of candidates) {
      canonicalByFqdn.set(candidate.fqdn, canonical);
    }
  }

  const normalizeFqdn = (fqdn: string) => canonicalByFqdn.get(fqdn) ?? fqdn;
  const normalizedNodes = new Map<string, GraphNode>();

  for (const node of data.nodes) {
    const canonical = normalizeFqdn(node.fqdn);
    const existing = normalizedNodes.get(canonical);
    const normalizedNode: GraphNode = { ...node, fqdn: canonical };
    if (!existing) {
      normalizedNodes.set(canonical, normalizedNode);
      continue;
    }
    if (node.fqdn === canonical) {
      normalizedNodes.set(canonical, mergeNodes(normalizedNode, existing));
    } else {
      normalizedNodes.set(canonical, mergeNodes(existing, normalizedNode));
    }
  }

  const normalizedEdges = data.edges.map((edge) => {
    const sourceFqdn = normalizeFqdn(edge.source_fqdn);
    const targetFqdn = normalizeFqdn(edge.target_fqdn);
    if (sourceFqdn === edge.source_fqdn && targetFqdn === edge.target_fqdn) {
      return edge;
    }
    return {
      ...edge,
      source_fqdn: sourceFqdn,
      target_fqdn: targetFqdn,
    };
  });

  return {
    nodes: [...normalizedNodes.values()],
    edges: normalizedEdges,
  };
}
