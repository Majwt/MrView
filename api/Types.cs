namespace api;

public sealed record Node(
    string Fqdn,
    string Ip
);

public sealed record Edge(
    string Id,
    
    string SourceIp,
    int SourcePort,
    string SourceFqdn,
    
    string TargetIp,
    int TargetPort,
    string TargetFqdn,
    
    int Pid,
    string? ProcessName,
    long SeenCount,
    int? SourcePid,
    string? SourceProcessName,
    int? TargetPid,
    string? TargetProcessName,

    DateTime LastSeen
);

public sealed record GraphResponse(
    IReadOnlyList<Node> Nodes,
    IReadOnlyList<Edge> Edges
);

public sealed record GraphCursor(
    DateTime LastSeen,
    long LastRowId
);

public sealed record GraphSnapshotResponse(
    IReadOnlyList<Node> Nodes,
    IReadOnlyList<Edge> Edges,
    GraphCursor Cursor
);

public sealed record GraphDeltaResponse(
    IReadOnlyList<Node> UpsertNodes,
    IReadOnlyList<Edge> UpsertEdges,
    IReadOnlyList<string> RemoveNodeIds,
    IReadOnlyList<string> RemoveEdgeIds,
    GraphCursor Cursor
);
