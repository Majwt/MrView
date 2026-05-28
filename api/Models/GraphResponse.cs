namespace Api.Models;

public sealed record GraphResponse(
    IEnumerable<NodeDto> UpsertNodes,
    IEnumerable<EdgeDto> UpsertEdges,
    IEnumerable<string> RemoveNodeIds,
    IEnumerable<string> RemoveEdgeIds,
    GraphCursor Cursor
);
