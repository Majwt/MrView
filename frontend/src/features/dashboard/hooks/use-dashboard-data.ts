import {
  fetchDashboardCards,
  fetchConnectionsHistory,
  type DashboardCardMetric,
  type ConnectionHistoryPoint,
} from "@/features/dashboard/api/dashboard-api";
import { useEffect, useMemo, useState } from "react";

export function useDashboardData(customerId: number | null, enabled = true) {
  const [cards, setCards] = useState<DashboardCardMetric[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [history, setHistory] = useState<ConnectionHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const metricWindowDays = 7;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    setCardsLoading(true);
    fetchDashboardCards(metricWindowDays, customerId)
      .then((nextCards) => {
        if (cancelled) return;
        setCards([...nextCards].sort((a, b) => a.display_order - b.display_order));
      })
      .finally(() => {
        if (!cancelled) setCardsLoading(false);
      });

    Promise.resolve()
      .then(() => {
        if (!cancelled) setLoading(true);
        return fetchConnectionsHistory(90, customerId);
      })
      .then((h) => {
        if (cancelled) return;
        setHistory(h);
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

  return { cards, cardsLoading, chartData, loading };
}
