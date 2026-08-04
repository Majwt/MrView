using Api.Models;

namespace Api.Database;

public class GraphReadRepository(Db db) : IGraphReadRepository
{
    public Task<IEnumerable<EdgeEntity>> getEdgesAsync(GraphCursor cursor, GraphQueryParams queryParams)
        => db.getEdgesAsync(cursor, queryParams);

    public Task<IEnumerable<EdgeEntity>> getCustomerEdgesAsync(GraphCursor cursor, int customerId, GraphQueryParams queryParams)
        => db.getCustomerEdgesAsync(cursor, customerId, queryParams);

    public Task<IEnumerable<EdgeEntity>> getDistinctEdgesAsync(GraphCursor cursor, GraphQueryParams queryParams)
        => db.getDistinctEdgesAsync(cursor, queryParams);

    public Task<IEnumerable<EdgeEntity>> getCustomerDistinctEdgesAsync(GraphCursor cursor, int customerId, GraphQueryParams queryParams)
        => db.getCustomerDistinctEdgesAsync(cursor, customerId, queryParams);

    public Task<IEnumerable<NodeSummaryEntity>> getNodeSummariesAsync(GraphCursor cursor, GraphQueryParams queryParams)
        => db.getNodeSummariesAsync(cursor, queryParams);

    public Task<IEnumerable<NodeSummaryEntity>> getCustomerNodeSummariesAsync(GraphCursor cursor, int customerId, GraphQueryParams queryParams)
        => db.getCustomerNodeSummariesAsync(cursor, customerId, queryParams);

    public Task<NodeEntity?> getNodeByCiidAsync(string ciid)
        => db.getNodeByCiidAsync(ciid);

    public Task<IEnumerable<string>> filterNodeCiidsAsync(
        string? customer,
        string? ip,
        string? mac,
        DateTime? firstSeenAfter,
        DateTime? firstSeenBefore,
        DateTime? lastSeenAfter,
        DateTime? lastSeenBefore,
        int? scopeCustomerId = null)
        => db.filterNodeCiidsAsync(
            customer,
            ip,
            mac,
            firstSeenAfter,
            firstSeenBefore,
            lastSeenAfter,
            lastSeenBefore,
            scopeCustomerId);
}
