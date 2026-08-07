using Api.Database;
using Api.Models;

public class DashboardService
{
    private readonly IDashboardReadRepository _dashboardReadRepository;

    public DashboardService(IDashboardReadRepository dashboardReadRepository)
    {
        _dashboardReadRepository = dashboardReadRepository;
    }
    public Task<DashboardMetric> GetDistinctEdgesAsync(int lastDays, int customerId = -1)
        => _dashboardReadRepository.GetDistinctEdgesAsync(lastDays, customerId);

    public Task<DashboardMetric> GetActiveNodesAsync(int lastDays, int customerId = -1)
        => _dashboardReadRepository.GetActiveNodesAsync(lastDays, customerId);

    public Task<DashboardMetric> GetTotalEventsAsync(int lastDays, int customerId = -1)
        => _dashboardReadRepository.GetTotalEventsAsync(lastDays, customerId);

    public Task<DashboardMetric> GetNewConnectionsAsync(int lastDays, int customerId = -1)
        => _dashboardReadRepository.GetNewConnectionsAsync(lastDays, customerId);

    public async Task<IReadOnlyList<DashboardCardMetric>> GetDashboardCardsAsync(int lastDays, int customerId = -1)
    {
        var distinctEdgesTask = GetDistinctEdgesAsync(lastDays, customerId);
        var activeNodesTask = GetActiveNodesAsync(lastDays, customerId);
        var totalEventsTask = GetTotalEventsAsync(lastDays, customerId);
        var newConnectionsTask = GetNewConnectionsAsync(lastDays, customerId);

        await Task.WhenAll(distinctEdgesTask, activeNodesTask, totalEventsTask, newConnectionsTask);

        return
        [
            ToCardMetric("distinct_edges", 1, distinctEdgesTask.Result),
            ToCardMetric("active_nodes", 2, activeNodesTask.Result),
            ToCardMetric("total_events", 3, totalEventsTask.Result),
            ToCardMetric("new_connections", 4, newConnectionsTask.Result),
        ];
    }


    public Task<DashboardStats> GetStatsAsync(int customerId = -1)
        => _dashboardReadRepository.GetDashboardStatsAsync(customerId);

    public Task<IEnumerable<ConnectionHistoryPoint>> GetConnectionsHistoryAsync(int days, int customerId = -1)
        => _dashboardReadRepository.GetConnectionsHistoryAsync(days, customerId);

    public Task<IEnumerable<ConnectionRow>> GetTopConnectionsAsync(int limit, int customerId = -1)
        => _dashboardReadRepository.GetTopConnectionsAsync(limit, customerId);

    public Task<IEnumerable<NodeRow>> GetDashboardNodesAsync(int limit, int customerId = -1)
        => _dashboardReadRepository.GetDashboardNodesAsync(limit, customerId);

    public Task<PagedResult<NodeRow>> GetDashboardNodesPageAsync(int page, int pageSize, string? query, int customerId = -1)
        => _dashboardReadRepository.GetDashboardNodesPageAsync(page, pageSize, query, customerId);

    private static DashboardCardMetric ToCardMetric(string id, int displayOrder, DashboardMetric metric)
        => new(
            Id: id,
            DisplayOrder: displayOrder,
            Name: metric.Name,
            Value: metric.Value,
            DescriptionHeader: metric.DescriptionHeader,
            DescriptionBody: metric.DescriptionBody,
            PreviousValue: metric.PreviousValue,
            PercentageChange: metric.PercentageChange
        );
}
