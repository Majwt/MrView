namespace Api.Models;

public sealed record GraphResponse(
    IEnumerable<NodeSummaryDto> UpsertNodes,
    IEnumerable<EdgeDto> UpsertEdges,
    IEnumerable<string> RemoveNodeIds,
    IEnumerable<string> RemoveEdgeIds,
    GraphCursor Cursor
);
