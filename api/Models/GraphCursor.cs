namespace Api.Models;

public sealed record GraphCursor(string LastSeen, long LastSeenEdgeId, long LastSeenNodeId);
