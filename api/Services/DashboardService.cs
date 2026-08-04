using Api.Database;
using Api.Models;

public class DashboardService
{
    private readonly IDashboardReadRepository _dashboardReadRepository;

    public DashboardService(IDashboardReadRepository dashboardReadRepository)
    {
        _dashboardReadRepository = dashboardReadRepository;
    }

    public Task<DashboardStats> GetStatsAsync(int customerId = -1)
        => _dashboardReadRepository.GetDashboardStatsAsync(customerId);

    public Task<IEnumerable<ConnectionHistoryPoint>> GetConnectionsHistoryAsync(int days, int customerId = -1)
        => _dashboardReadRepository.GetConnectionsHistoryAsync(days, customerId);

    public Task<IEnumerable<ConnectionRow>> GetTopConnectionsAsync(int limit, int customerId = -1)
        => _dashboardReadRepository.GetTopConnectionsAsync(limit, customerId);

    public Task<IEnumerable<NodeRow>> GetDashboardNodesAsync(int limit, int customerId = -1)
        => _dashboardReadRepository.GetDashboardNodesAsync(limit, customerId);
}
