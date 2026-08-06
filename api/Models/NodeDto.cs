
namespace Api.Models;


public sealed record NodeDto(
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

