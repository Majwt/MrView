import Graph from "graphology";
import type { GraphData } from "../types/graph";
import type { NodeDetails, NodePortTarget } from "../types/graph";
import type { GraphEdge } from "../types/graph";

type PortTarget = NodePortTarget;

function getNodeSize(connectionCount: number): number {
  const baseSize = 10;
  const growth = Math.sqrt(Math.max(connectionCount, 0)) * 1.1;
  return Math.min(baseSize + growth, 100);
}

function getFqdnSuffix(fqdn: string): string {
  const parts = fqdn.split(".").filter(Boolean);
  return parts.length ? parts[parts.length - 1].toLowerCase() : fqdn.toLowerCase();
}

function getNodeColor(fqdn: string): string {
  const suffix = getFqdnSuffix(fqdn);
  let hash = 0;
  for (let i = 0; i < suffix.length; i += 1) {
    hash = (hash * 48 + suffix.charCodeAt(i)) >>> 0;
  }
  const r = 64 + (hash & 0x7f);
  const g = 64 + ((hash >>> 8) & 0x7f);
  const b = 64 + ((hash >>> 16) & 0x7f);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function createEdgePortIndex(edges: GraphEdge[]): Map<string, PortTarget[]> {
  const index = new Map<string, Map<string, PortTarget>>();

  function addTarget(ownerFqdn: string, target: Omit<PortTarget, "seenCount">, seenCount: number) {
    let groupedTargets = index.get(ownerFqdn);
    if (!groupedTargets) {
      groupedTargets = new Map<string, PortTarget>();
      index.set(ownerFqdn, groupedTargets);
    }

    const key = `${target.port}->${target.remote_port}->${target.fqdn}->${target.ip}->${target.direction}->${target.pid}->${target.processName ?? ""}`;
    const existing = groupedTargets.get(key);
    if (existing) {
      existing.seenCount += seenCount;
      return;
    }

    groupedTargets.set(key, { ...target, seenCount });
  }

  for (const edge of edges) {
    const seenCount = Math.max(edge.seen_count ?? 1, 1);
    const sourcePid = edge.source_pid ?? edge.pid ?? -1;
    const sourceProcessName = edge.source_process_name ?? edge.process_name ?? null;
    const targetPid = edge.target_pid ?? edge.pid ?? -1;
    const targetProcessName = edge.target_process_name ?? edge.process_name ?? null;

    addTarget(edge.source_fqdn, {
      port: edge.source_port,
      remote_port: edge.target_port,
      fqdn: edge.target_fqdn,
      ip: edge.target_ip,
      direction: "outgoing",
      pid: sourcePid,
      processName: sourceProcessName,
      lastSeen: edge.last_seen ?? new Date().toISOString(),
    }, seenCount);

    addTarget(edge.target_fqdn, {
      port: edge.target_port,
      remote_port: edge.source_port,
      fqdn: edge.source_fqdn,
      ip: edge.source_ip,
      direction: "incoming",
      pid: targetPid,
      processName: targetProcessName,
      lastSeen: edge.last_seen ?? new Date().toISOString(),
    }, seenCount);
  }

  const result = new Map<string, PortTarget[]>();
  for (const [fqdn, groupedTargets] of index) {
    const targets = Array.from(groupedTargets.values());
    targets.sort((a, b) =>
      b.seenCount - a.seenCount
      || a.port - b.port
      || a.remote_port - b.remote_port
      || a.fqdn.localeCompare(b.fqdn)
      || a.direction.localeCompare(b.direction)
      || a.pid - b.pid
      || (a.processName ?? "").localeCompare(b.processName ?? "")
    );
    result.set(fqdn, targets);
  }

  return result;
}
 
/**
 * Adds nodes to the graph based on the provided graph data.
 *
 * @param graph - The graph to add nodes to.
 * @param data - The graph data containing nodes and edges.
 */
export function addNodes(graph: Graph, data: GraphData) {
  const { nodes, edges } = data;
  const portTargetsIndex = createEdgePortIndex(edges);
  const fqdnToIp = new Map<string, string>();
  const allFqdns = new Set<string>();
  const connectionCountByFqdn = new Map<string, number>();

  for (const node of nodes) {
    allFqdns.add(node.fqdn);
    if (node.ip) fqdnToIp.set(node.fqdn, node.ip);
  }

  for (const edge of edges) {
    const seenCount = Math.max(edge.seen_count ?? 1, 1);
    allFqdns.add(edge.source_fqdn);
    allFqdns.add(edge.target_fqdn);
    if (!fqdnToIp.has(edge.source_fqdn)) fqdnToIp.set(edge.source_fqdn, edge.source_ip);
    if (!fqdnToIp.has(edge.target_fqdn)) fqdnToIp.set(edge.target_fqdn, edge.target_ip);
    connectionCountByFqdn.set(edge.source_fqdn, (connectionCountByFqdn.get(edge.source_fqdn) ?? 0) + seenCount);
    connectionCountByFqdn.set(edge.target_fqdn, (connectionCountByFqdn.get(edge.target_fqdn) ?? 0) + seenCount);
  }

  const total = Math.max(allFqdns.size, 1);
  const radius = 10;
  let index = 0;

  for (const fqdn of allFqdns) {
    if (graph.hasNode(fqdn)) continue;

    const angle = (2 * Math.PI * index) / total;
    const nodeDetails: NodeDetails = {
      label: fqdn,
      ip: fqdnToIp.get(fqdn) ?? "",
      fqdn,
      color: getNodeColor(fqdn),
      subnet: "",
      portTargets: portTargetsIndex.get(fqdn) ?? [],
      size: getNodeSize(connectionCountByFqdn.get(fqdn) ?? 0),
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };

    graph.addNode(fqdn, nodeDetails);
    index++;
  }
}
