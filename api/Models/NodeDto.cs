
namespace Api.Models;


public sealed record NodeDto(
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

