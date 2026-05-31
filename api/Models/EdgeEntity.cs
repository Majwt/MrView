namespace Api.Models;

public sealed record EdgeEntity(
    long Id, // Row id from the database, not a unique identifier for the edge

    string EndpointA,
    string EndpointB,

    string ServiceFqdn,
    int? ServicePort,
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
    DateTimeOffset LastSeen,
    DateTimeOffset FirstSeen,
    string EdgeKey // stable id based on the edge properties, not the database row id, computed in the database
);
