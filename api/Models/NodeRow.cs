namespace Api.Models;

public sealed record NodeRow(
    string Ciid,
    string Fqdn,
    string Hostname,
    long DistinctEdges,
    long ConnectionCount,
    DateTime FirstSeen,
    DateTime LastSeen,
    string GroupName
);
