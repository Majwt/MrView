import * as React from "react";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { DataTable } from "@/components/data-table";
import { SectionCards } from "@/components/section-cards";
import {
  fetchDashboardStats,
  fetchConnectionsHistory,
  fetchDashboardNodes,
  type DashboardStats,
  type ConnectionHistoryPoint,
  type NodeRow,
} from "@/api/dashboard-api";

export default function DashboardPage() {
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [history, setHistory] = React.useState<ConnectionHistoryPoint[]>([]);
  const [nodes, setNodes] = React.useState<NodeRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchDashboardStats(),
      fetchConnectionsHistory(90),
      fetchDashboardNodes(100),
    ])
      .then(([s, h, n]) => {
        setStats(s);
        setHistory(h);
        setNodes(n);
      })
      .finally(() => setLoading(false));
  }, []);

  const chartData = history.map((p) => ({
    date: p.date.slice(0, 10),
    total: p.total_connections,
    distinct: p.distinct_connections,
  }));

  return (
    <div className="flex flex-1 flex-col overflow-auto @container/main">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <SectionCards stats={stats} loading={loading} />
        <ChartAreaInteractive data={chartData} loading={loading} />
        <DataTable data={nodes} />
      </div>
    </div>
  );
}

