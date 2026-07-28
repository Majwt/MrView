namespace Api.Models;

public sealed record NodeSummaryEntity(
    long NodeId,
    string Ciid,
    string Fqdn,
    string Hostname,
    long DistinctEdge,
    long ConnectionCount,
    DateTime LastSeen
);

public sealed record NodeEntity(
    long Id,
    string Fqdn,
    string Hostname,
    IEnumerable<NetInterface> Interfaces,
    long DistinctEdge,
    long ConnectionCount,
    Customer Customer,
    DateTime FirstSeen,
    DateTime LastSeen
);
