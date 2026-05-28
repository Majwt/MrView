namespace Api.Models;

public sealed record Interface(string Ip, string Mac, string Subnet);

public sealed record NodeDto(
    string Fqdn,
    string Ip,
    IEnumerable<Interface> Interfaces,
    int DistinctEdge,
    int ConnectionCount,
    Customer Customer,
    DateTime FirstSeen,
    DateTime LastSeen
);
