namespace Api.Models;

public sealed record EdgeDto(
    string Id,
    string Protocol,
    string ServiceName,
    string SourceIp,
    int? SourcePort,
    string SourceFqdn,
    int? SourcePid,
    string? SourceProcessName,
    string TargetIp,
    int? TargetPort,
    string TargetFqdn,
    int? TargetPid,
    string? TargetProcessName,
    long SeenCount,
    DateTime LastSeen,
    DateTime FirstSeen
);
