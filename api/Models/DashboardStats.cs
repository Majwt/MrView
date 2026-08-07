namespace Api.Models;

public record DashboardStats(
    long TotalEdges,
    long ActiveNodes,
    long TotalSeenCount,
    long NewEdgesLast7Days
);
