namespace Api.Models;

public sealed record OpenPort(
    string? Proto,
    string? LocalIp,
    string? LocalPort,
    string? ForeignIp,
    string? ForeignPort,
    int? Pid
);

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
    string Os,
    string Client,
    string ClientVersion,
    IEnumerable<NetInterface> Interfaces,
    long DistinctEdge,
    long ConnectionCount,
    Customer Customer,
    DateTime FirstSeen,
    DateTime LastSeen
);
