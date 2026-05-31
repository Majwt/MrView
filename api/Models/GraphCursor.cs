namespace Api.Models;

public sealed record GraphCursor(DateTimeOffset LastSeen, long LastSeenEdgeId, long LastSeenNodeId);
