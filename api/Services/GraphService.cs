using Api.Database;
using Api.Models;

public class GraphService
{
    private Db db;
    private readonly ILogger<GraphService> _logger;

    public GraphService(ILogger<GraphService> logger, Db _db)
    {
        _logger = logger;
        db = _db;
    }

    public async Task<GraphResponse> GetGraphAsync(int customerId = -1, GraphQueryParams? queryParams = null)
    {
        var cursor = new GraphCursor(DateTime.UnixEpoch, 0, 0);
        return await GetGraphAsync(cursor, customerId, queryParams);
    }

    public async Task<GraphResponse> GetGraphAsync(GraphCursor cursor, int customerId = -1, GraphQueryParams? queryParams = null)
    {
        var qp = queryParams ?? new GraphQueryParams();

        Task<IEnumerable<EdgeEntity>> dbEdgesTask;
        Task<IEnumerable<NodeSummaryEntity>> dbNodesTask;

        if (customerId == -1)
        {
            dbEdgesTask = db.getEdgesAsync(cursor);
            dbNodesTask = db.getNodeSummariesAsync(cursor, qp);
        }
        else
        {
            dbEdgesTask = db.getCustomerEdgesAsync(cursor, customerId);
            dbNodesTask = db.getCustomerNodeSummariesAsync(cursor, customerId, qp);
        }

        await Task.WhenAll(dbEdgesTask, dbNodesTask);
        var dbNodes = dbNodesTask.Result;
        var dbEdges = dbEdgesTask.Result;

        var nodes = ToNodeSummaryDtos(dbNodes);
        var edges = ToEdgeDtos(dbEdges);
        var nextCursor = GetNextCursor(cursor, dbNodes, dbEdges);

        return new GraphResponse(
            nodes,
            edges,
            new List<string>(),
            new List<string>(),
            nextCursor
        );
    }

    public async Task<NodeDto?> GetNodeDetailsAsync(string ciid)
    {
        var entity = await db.getNodeByCiidAsync(ciid);
        if (entity == null) return null;
        return ToNodeDto(entity);
    }

    public async Task<IEnumerable<string>> FilterNodeCiidsAsync(
        string? customer, string? ip, string? mac,
        DateTime? firstSeenAfter, DateTime? firstSeenBefore,
        DateTime? lastSeenAfter, DateTime? lastSeenBefore,
        int? scopeCustomerId = null)
    {
        return await db.filterNodeCiidsAsync(customer, ip, mac, firstSeenAfter, firstSeenBefore, lastSeenAfter, lastSeenBefore, scopeCustomerId);
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
