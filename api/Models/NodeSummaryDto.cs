namespace Api.Models;

public sealed record NodeSummaryDto(
    string Ciid,
    string Fqdn,
    string Hostname,
    long DistinctEdge,
    long ConnectionCount
);
