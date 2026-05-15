import { fuzzy } from "fast-fuzzy";
import type { filter } from "../types/filter";
import type { GraphData, GraphEdge, NodeDetails, NodePortTarget } from "../types/graph";
import type Graph from "graphology";
import { getServiceName } from "../utils/portServices";

export type EdgeFilterContext = {
  sourceNode: NodeDetails;
  targetNode: NodeDetails;
  connections: GraphEdge[];
};

export function buildEffectiveFilters(filters: filter[], searchQuery: string): filter[] {
  if (!searchQuery.trim()) return filters;
  return [
    ...filters,
    {
      id: "__search__",
      type: "fqdn",
      operation: "include",
      value: searchQuery,
    },
  ];
}

export function matchesEdgeFilters(edge: EdgeFilterContext, filters: filter[]): boolean {
  if (filters.length === 0) return true;
  return filters.every((entry) => matchesEdgeFilter(edge, entry));
}

export function edgeMatchesFilters(graph: Graph, edge: string, filters: filter[]) {
  const [source, target] = graph.extremities(edge);
  const sourceNode = graph.getNodeAttributes(source) as NodeDetails;
  const targetNode = graph.getNodeAttributes(target) as NodeDetails;
  const edgeData = graph.getEdgeAttributes(edge) as { connections?: unknown };
  const connections = Array.isArray(edgeData.connections) ? edgeData.connections as GraphData["edges"] : [];

  return matchesEdgeFilters({ sourceNode, targetNode, connections }, filters);
}

export function matchesNodeConnectionFilters(node: NodeDetails, target: NodePortTarget, filters: filter[]): boolean {
  if (filters.length === 0) return true;


  return filters.every((entry) => matchesNodeConnectionFilter(node, target, entry));
}


function matchesEdgeFilter(edge: EdgeFilterContext, entry: filter): boolean {
  const value = entry.value.trim();
  if (!value) return true;

  if (entry.type === "port") {
    const port = Number(value);
    if (Number.isNaN(port)) return true;

    const matchesPort = edge.connections.some(
      (connection) => port === connection.source_port || port === connection.target_port,
    );

    return applyOperation(matchesPort, entry.operation);
  }

  if (entry.type === "ip") {
    const lowerValue = value.toLowerCase();
    const ipMatches = edge.sourceNode.ip.toLowerCase() === lowerValue || edge.targetNode.ip.toLowerCase() === lowerValue;
    return applyOperation(ipMatches, entry.operation);
  }

  if (entry.type === "fqdn") {
    const fqdnMatches = matchesFqdn(edge.sourceNode.fqdn, value); //|| matchesFqdn(edge.targetNode.fqdn, value);
    return applyOperation(fqdnMatches, entry.operation);
  }

  if (entry.type === "process") {
    const lowerValue = value.toLowerCase();
    const processMatches = edge.connections.some((connection) =>
      (connection.process_name ?? "").toLowerCase().includes(lowerValue)
      || (connection.source_process_name ?? "").toLowerCase().includes(lowerValue)
      || (connection.target_process_name ?? "").toLowerCase().includes(lowerValue),
    );
    return applyOperation(processMatches, entry.operation);
  }

  if (entry.type === "service") {
    const lowerValue = value.toLowerCase();
    const serviceMatches = edge.connections.some((connection) => {
      const sourceService = getServiceName(connection.source_port).toLowerCase();
      const targetService = getServiceName(connection.target_port).toLowerCase();
      const serviceMatches = sourceService === lowerValue || targetService === lowerValue;
      return serviceMatches;
    });
    return applyOperation(serviceMatches, entry.operation);
  }

  return true;
}

function matchesNodeConnectionFilter(node: NodeDetails, target: NodePortTarget, entry: filter): boolean {
  const value = entry.value.trim();
  if (!value) return true;

  if (entry.type === "port") {
    const port = Number(value);
    if (Number.isNaN(port)) return true;
    const matchesPort = port === target.port || port === target.remote_port;
    return applyOperation(matchesPort, entry.operation);
  }

  if (entry.type === "ip") {
    const lowerValue = value.toLowerCase();
    const ipMatches = node.ip.toLowerCase() === lowerValue || target.ip.toLowerCase() === lowerValue;
    return applyOperation(ipMatches, entry.operation);
  }

  if (entry.type === "fqdn") {
    const fqdnMatches = matchesFqdn(node.fqdn, value)// || matchesFqdn(target.fqdn, value);
    return applyOperation(fqdnMatches, entry.operation);
  }

  if (entry.type === "process") {
    const processMatches = (target.processName ?? "").toLowerCase().includes(value.toLowerCase());
    return applyOperation(processMatches, entry.operation);
  }

  if (entry.type === "service") {
    const lowerValue = value.toLowerCase();
    const localService = getServiceName(target.port).toLowerCase();
    const remoteService = getServiceName(target.remote_port).toLowerCase();
    const serviceMatches = localService === lowerValue || remoteService === lowerValue;
    return applyOperation(serviceMatches, entry.operation);
  }

  return true;
}

function applyOperation(matches: boolean, operation: filter["operation"]): boolean {
  return operation === "include" ? matches : !matches;
}

function normalizeFqdn(s: string): string {
  return s.trim().toLowerCase().replace(/\.$/, "");
}

function matchesFqdn(fqdn: string, rawPattern: string): boolean {
  const host = normalizeFqdn(fqdn);
  const pattern = normalizeFqdn(rawPattern);
  const firstLabel = host.split(".")[0] ?? "";

  if (!pattern) return true;

  if (pattern.startsWith(".")) return host.endsWith(pattern);

  if (pattern.endsWith("*")) {
    const prefix = pattern.slice(0, -1);
    return firstLabel.startsWith(prefix);
  }

  if (!pattern.includes(".")) return firstLabel.startsWith(pattern);


  return matchesFqdnFuzzy(host, firstLabel, pattern);
}

function matchesFqdnFuzzy(host: string, firstLabel: string, pattern: string): boolean {
  if (pattern.length < 1) return false;

  const fullScore = fuzzy(pattern, host);
  const labelScore = fuzzy(pattern, firstLabel);

  return Math.max(fullScore, labelScore) >= 0.95;
}
