using Api.Models;

namespace Api.Database;

public interface IDashboardReadRepository
{

    Task<DashboardMetric> GetDistinctEdgesAsync(int lastDays, int customerId = -1);
    Task<DashboardMetric> GetActiveNodesAsync(int lastDays, int customerId = -1);
    Task<DashboardMetric> GetTotalEventsAsync(int lastDays, int customerId = -1);
    Task<DashboardMetric> GetNewConnectionsAsync(int lastDays, int customerId = -1);

    Task<DashboardStats> GetDashboardStatsAsync(int customerId = -1);
    Task<IEnumerable<ConnectionHistoryPoint>> GetConnectionsHistoryAsync(int days, int customerId = -1);
    Task<IEnumerable<ConnectionRow>> GetTopConnectionsAsync(int limit, int customerId = -1);
    Task<IEnumerable<NodeRow>> GetDashboardNodesAsync(int limit, int customerId = -1);
}
