namespace Api.Models;

public record ConnectionHistoryPoint(
    DateTime Date,
    long TotalConnections,
    long DistinctConnections
);
