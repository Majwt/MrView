using Api.Database;
using Api.Models;
using Microsoft.Extensions.Caching.Memory;

public class GraphService
{
    private readonly IGraphReadRepository _graphRepository;
    private readonly ILogger<GraphService> _logger;
    private readonly IMemoryCache _cache;
    private static readonly TimeSpan GraphCacheTtl = TimeSpan.FromMinutes(5);

    public GraphService(ILogger<GraphService> logger, IGraphReadRepository graphRepository, IMemoryCache cache)
    {
        _logger = logger;
        _graphRepository = graphRepository;
        _cache = cache;
    }

    public async Task<GraphResponse> GetGraphAsync(int customerId = -1, GraphQueryParams? queryParams = null)
    {
        var cursor = new GraphCursor(DateTime.UnixEpoch, 0, 0);
        return await GetGraphAsync(cursor, customerId, queryParams);
    }

    public async Task<GraphResponse> GetGraphAsync(GraphCursor cursor, int customerId = -1, GraphQueryParams? queryParams = null)
    {
        var qp = queryParams ?? new GraphQueryParams();
        var cacheKey = BuildGraphCacheKey(cursor, customerId, qp);

        return await _cache.GetOrCreateAsync(cacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = GraphCacheTtl;

            Task<IEnumerable<EdgeEntity>> dbEdgesTask;
            Task<IEnumerable<NodeSummaryEntity>> dbNodesTask;

            if (customerId == -1)
            {
                dbEdgesTask = qp.DistinctEdgesOnly
                    ? _graphRepository.getDistinctEdgesAsync(cursor, qp)
                    : _graphRepository.getEdgesAsync(cursor, qp);
                dbNodesTask = _graphRepository.getNodeSummariesAsync(cursor, qp);
            }
            else
            {
                dbEdgesTask = qp.DistinctEdgesOnly
                    ? _graphRepository.getCustomerDistinctEdgesAsync(cursor, customerId, qp)
                    : _graphRepository.getCustomerEdgesAsync(cursor, customerId, qp);
                dbNodesTask = _graphRepository.getCustomerNodeSummariesAsync(cursor, customerId, qp);
            }

            await Task.WhenAll(dbEdgesTask, dbNodesTask);
            var dbNodes = dbNodesTask.Result;
            var dbEdges = dbEdgesTask.Result;

            // Materialize before caching so we do not cache deferred enumerables.
            var nodes = ToNodeSummaryDtos(dbNodes).ToList();
            var edges = ToEdgeDtos(dbEdges).ToList();
            var nextCursor = GetNextCursor(cursor, dbNodes, dbEdges);

            return new GraphResponse(
                nodes,
                edges,
                new List<string>(),
                new List<string>(),
                nextCursor
            );
        }) ?? throw new InvalidOperationException("Cache returned null graph response.");
    }

    public async Task<NodeDto?> GetNodeDetailsAsync(string ciid)
    {
        var entity = await _graphRepository.getNodeByCiidAsync(ciid);
        if (entity == null) return null;
        return ToNodeDto(entity);
    }

    public async Task<IEnumerable<string>> FilterNodeCiidsAsync(
        string? customer, string? ip, string? mac,
        DateTime? firstSeenAfter, DateTime? firstSeenBefore,
        DateTime? lastSeenAfter, DateTime? lastSeenBefore,
        int? scopeCustomerId = null)
    {
        return await _graphRepository.filterNodeCiidsAsync(
            customer,
            ip,
            mac,
            firstSeenAfter,
            firstSeenBefore,
            lastSeenAfter,
            lastSeenBefore,
            scopeCustomerId);
    }

    private static IEnumerable<NodeSummaryDto> ToNodeSummaryDtos(IEnumerable<NodeSummaryEntity> nodes)
    {
        return nodes.Select(n => new NodeSummaryDto(
            n.Ciid,
            n.Fqdn,
            n.Hostname,
            n.DistinctEdge,
            n.ConnectionCount
        ));
    }

    private static NodeDto ToNodeDto(NodeEntity n)
    {
        return new NodeDto(
            n.Id,
            n.Fqdn,
            n.Hostname,
            n.Os,
            n.Client,
            n.ClientVersion,
            n.Interfaces,
            n.DistinctEdge,
            n.ConnectionCount,
            n.Customer,
            n.FirstSeen,
            n.LastSeen
        );
    }

    private static IEnumerable<EdgeDto> ToEdgeDtos(IEnumerable<EdgeEntity> edges)
    {
        return edges.Select(e => new EdgeDto(
            e.EdgeKey,
            e.ServiceName,
            e.SourceIp,
            e.SourcePort,
            e.SourceFqdn,
            e.SourcePid,
            e.SourceProcessName,
            e.TargetIp,
            e.TargetPort,
            e.TargetFqdn,
            e.TargetPid,
            e.TargetProcessName,
            e.SeenCount,
            e.LastSeen,
            e.FirstSeen
        ));
    }

    private static string BuildGraphCacheKey(GraphCursor cursor, int customerId, GraphQueryParams qp)
    {
        return string.Join(
            '|',
            "graph",
            customerId,
            cursor.LastSeen.Ticks,
            cursor.LastSeenEdgeId,
            cursor.LastSeenNodeId,
            qp.ExcludeIsolated ? 1 : 0,
            qp.MinLastSeenHours ?? -1,
            qp.ManagedOnly ? 1 : 0,
            qp.DistinctEdgesOnly ? 1 : 0
        );
    }

    private GraphCursor GetNextCursor(
        GraphCursor currentCursor,
        IEnumerable<NodeSummaryEntity> nodes,
        IEnumerable<EdgeEntity> edges
    )
    {
        var maxNodeId = nodes.Any() ? nodes.Max(n => n.NodeId) : 0;
        var maxEdgeId = edges.Any() ? edges.Max(e => e.Id) : 0;
        var lastSeenNode = nodes.OrderByDescending(n => n.LastSeen).FirstOrDefault();
        var lastSeenEdge = edges.OrderByDescending(e => e.LastSeen).FirstOrDefault();

        var lastSeen =
            lastSeenNode != null && lastSeenEdge != null
                ? (lastSeenNode.LastSeen > lastSeenEdge.LastSeen ? lastSeenNode.LastSeen : lastSeenEdge.LastSeen)
                : (lastSeenNode != null ? lastSeenNode.LastSeen
                    : (lastSeenEdge != null ? lastSeenEdge.LastSeen : DateTime.UnixEpoch));

        var maxLastSeen = currentCursor.LastSeen > lastSeen ? currentCursor.LastSeen : lastSeen;
        var maxMaxEdgeId = currentCursor.LastSeen == maxLastSeen ? Math.Max(currentCursor.LastSeenEdgeId, maxEdgeId) : maxEdgeId;
        var maxMaxNodeId = currentCursor.LastSeen == maxLastSeen ? Math.Max(currentCursor.LastSeenNodeId, maxNodeId) : maxNodeId;

        return new GraphCursor(maxLastSeen, maxMaxEdgeId, maxMaxNodeId);
    }
}
