namespace Api.Models;

public sealed record GraphResponse(
    IReadOnlyList<NodeDto> UpsertNodes,
    IReadOnlyList<EdgeDto> UpsertEdges,
    IReadOnlyList<string> RemoveNodeIds,
    IReadOnlyList<string> RemoveEdgeIds,
    GraphCursor Cursor
);
