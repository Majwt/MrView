namespace Api.Models;


public sealed record NodeEntity(
    long Id,
    string Fqdn,
    string Hostname,
    IEnumerable<NetInterface> Interfaces,
    long DistinctEdge,
    long ConnectionCount,
    Customer Customer,
    DateTimeOffset FirstSeen,
    DateTimeOffset LastSeen
);
