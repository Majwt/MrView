import {
  fetchConnectionsHistory,
  fetchDashboardNodes,
  fetchDashboardStats,
  type ConnectionHistoryPoint,
  type DashboardStats,
  type NodeRow,
} from "@/features/dashboard/api/dashboard-api";
import { useEffect, useMemo, useState } from "react";

export function useDashboardData(customerId: number | null, enabled = true) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [history, setHistory] = useState<ConnectionHistoryPoint[]>([]);
  const [nodes, setNodes] = useState<NodeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    Promise.resolve()
      .then(() => {
        if (!cancelled) setLoading(true);
        return Promise.all([
          fetchDashboardStats(customerId),
          fetchConnectionsHistory(90, customerId),
          fetchDashboardNodes(100, customerId),
        ]);
      })
      .then(([s, h, n]) => {
        if (cancelled) return;
        setStats(s);
        setHistory(h);
        setNodes(n);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [customerId, enabled]);

  const chartData = useMemo(
    () =>
      history.map((p) => ({
        date: p.date.slice(0, 10),
        total: p.total_connections,
        distinct: p.distinct_connections,
      })),
    [history],
  );

  return { stats, chartData, nodes, loading };
}
