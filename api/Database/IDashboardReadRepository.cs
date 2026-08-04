using Api.Models;

namespace Api.Database;

public interface IDashboardReadRepository
{
    Task<DashboardStats> GetDashboardStatsAsync(int customerId = -1);
    Task<IEnumerable<ConnectionHistoryPoint>> GetConnectionsHistoryAsync(int days, int customerId = -1);
    Task<IEnumerable<ConnectionRow>> GetTopConnectionsAsync(int limit, int customerId = -1);
    Task<IEnumerable<NodeRow>> GetDashboardNodesAsync(int limit, int customerId = -1);
}
