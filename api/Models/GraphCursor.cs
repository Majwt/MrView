namespace Api.Models;

public sealed record GraphCursor(DateTime LastSeen, long LastSeenEdgeId, long LastSeenNodeId);
