namespace Api.Models;

public sealed record NodeRow(
    string Ciid,
    string Fqdn,
    string Hostname,
    string Os,
    string Client,
    string ClientVersion,
    long DistinctEdges,
    long ConnectionCount,
    DateTime FirstSeen,
    DateTime LastSeen,
    string GroupName
);
