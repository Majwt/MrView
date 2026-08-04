using Api.Models;

namespace Api.Database;

public interface IGraphReadRepository
{
    Task<IEnumerable<EdgeEntity>> getEdgesAsync(GraphCursor cursor, GraphQueryParams queryParams);
    Task<IEnumerable<EdgeEntity>> getCustomerEdgesAsync(GraphCursor cursor, int customerId, GraphQueryParams queryParams);
    Task<IEnumerable<EdgeEntity>> getDistinctEdgesAsync(GraphCursor cursor, GraphQueryParams queryParams);
    Task<IEnumerable<EdgeEntity>> getCustomerDistinctEdgesAsync(GraphCursor cursor, int customerId, GraphQueryParams queryParams);
    Task<IEnumerable<NodeSummaryEntity>> getNodeSummariesAsync(GraphCursor cursor, GraphQueryParams queryParams);
    Task<IEnumerable<NodeSummaryEntity>> getCustomerNodeSummariesAsync(GraphCursor cursor, int customerId, GraphQueryParams queryParams);
    Task<NodeEntity?> getNodeByCiidAsync(string ciid);
    Task<IEnumerable<string>> filterNodeCiidsAsync(
        string? customer,
        string? ip,
        string? mac,
        DateTime? firstSeenAfter,
        DateTime? firstSeenBefore,
        DateTime? lastSeenAfter,
        DateTime? lastSeenBefore,
        int? scopeCustomerId = null);
}
