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

    /**
     * Gets the graph without a cursor. This method is intended for initial graph retrieval when the client does not have a cursor yet. It retrieves all nodes and edges for the specified customer ID. If no customer ID is provided, it return the whole graph.
     * @param customerId The ID of the customer for whom to get the graph.
     * @returns A task that represents the asynchronous operation. The task result contains the graph response.
     */

    public async Task<GraphResponse> GetGraphAsync(int customerId = -1)
    {
        var cursor = new GraphCursor(DateTime.UnixEpoch, 0, 0);
        return await GetGraphAsync(cursor, customerId);
    }

    public async Task<GraphResponse> GetGraphAsync(GraphCursor cursor, int customerId = -1)
    {

        Task<IEnumerable<EdgeEntity>> dbEdgesTask;
        Task<IEnumerable<NodeEntity>> dbNodesTask;
        if (customerId == -1)
        {
            dbEdgesTask = db.getEdgesAsync(cursor);
            dbNodesTask = db.getNodesAsync(cursor);
        }
        else
        {
            dbEdgesTask = db.getCustomerEdgesAsync(cursor, customerId);
            dbNodesTask = db.getCustomerNodesAsync(cursor, customerId);
        }

        await Task.WhenAll(dbEdgesTask, dbNodesTask);
        var dbNodes = dbNodesTask.Result;
        var dbEdges = dbEdgesTask.Result;

        var nodes = ToNodeDtos(dbNodes);

        var edges = ToEdgeDtos(dbEdges);



        var nextCursor = getNextCursor(cursor,dbNodes, dbEdges);

        return new GraphResponse(
            nodes,
            edges,
            new List<string>(), // Not implemented
            new List<string>(), // Not implemented
            nextCursor
        );
    }

    private static IEnumerable<NodeDto> ToNodeDtos(IEnumerable<NodeEntity> nodes)
    {
        return nodes.Select(n => new NodeDto(
            n.Id,
            n.Fqdn,
            n.Hostname,
            n.Interfaces,
            n.DistinctEdge,
            n.ConnectionCount,
            n.Customer,
            n.FirstSeen,
            n.LastSeen
        ));
    }

    private static IEnumerable<EdgeDto> ToEdgeDtos(IEnumerable<EdgeEntity> edges)
    {
        var dtos = new List<EdgeDto>();

        edges
            .ToList()
            .ForEach(e =>
                dtos.Add(
                    new EdgeDto(
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
                    )
                )
            );
        return dtos;
    }

    private GraphCursor getNextCursor(
        GraphCursor currentCursor,
        IEnumerable<NodeEntity> nodes,
        IEnumerable<EdgeEntity> edges
    )
    {
        var maxNodeId = nodes.Any() ? nodes.Max(n => n.Id) : 0;
        var maxEdgeId = edges.Any() ? edges.Max(e => e.Id) : 0;
        var lastSeenNode = nodes.OrderByDescending(e => e.LastSeen).FirstOrDefault();
        var lastSeenEdge = edges.OrderByDescending(e => e.LastSeen).FirstOrDefault();

        var lastSeen =
            lastSeenNode != null && lastSeenEdge != null
                ? (
                    lastSeenNode.LastSeen > lastSeenEdge.LastSeen
                        ? lastSeenNode.LastSeen
                        : lastSeenEdge.LastSeen
                )
                : (
                    lastSeenNode != null
                        ? lastSeenNode.LastSeen
                        : (lastSeenEdge != null ? lastSeenEdge.LastSeen : DateTime.UnixEpoch)
                );
        var maxLastSeen = currentCursor.LastSeen > lastSeen ? currentCursor.LastSeen : lastSeen;
        var maxMaxEdgeId = currentCursor.LastSeen == maxLastSeen ? Math.Max(currentCursor.LastSeenEdgeId, maxEdgeId) : maxEdgeId;
        var maxMaxNodeId = currentCursor.LastSeen == maxLastSeen ? Math.Max(currentCursor.LastSeenNodeId, maxNodeId) : maxNodeId;

        return new GraphCursor(maxLastSeen, maxMaxEdgeId, maxMaxNodeId);
    }
}
