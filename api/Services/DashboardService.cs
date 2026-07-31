using Api.Database;
using Api.Models;

public class DashboardService
{
    private readonly Db _db;

    public DashboardService(Db db)
    {
        _db = db;
    }

    public Task<DashboardStats> GetStatsAsync(int customerId = -1)
        => _db.GetDashboardStatsAsync(customerId);

    public Task<IEnumerable<ConnectionHistoryPoint>> GetConnectionsHistoryAsync(int days, int customerId = -1)
        => _db.GetConnectionsHistoryAsync(days, customerId);

    public Task<IEnumerable<ConnectionRow>> GetTopConnectionsAsync(int limit, int customerId = -1)
        => _db.GetTopConnectionsAsync(limit, customerId);

    public Task<IEnumerable<NodeRow>> GetDashboardNodesAsync(int limit, int customerId = -1)
        => _db.GetDashboardNodesAsync(limit, customerId);
}
