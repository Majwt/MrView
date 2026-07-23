namespace Api.Models;

public sealed record EdgeDto(
    string Id, // stable id based on properties of the edge, not the database id
    string ServiceName,
    string SourceIp,
    long? SourcePort,
    string SourceFqdn,
    long? SourcePid,
    string? SourceProcessName,
    string TargetIp,
    long? TargetPort,
    string TargetFqdn,
    long? TargetPid,
    string? TargetProcessName,
    long SeenCount,
    DateTime LastSeen,
    DateTime FirstSeen
);

