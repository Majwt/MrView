namespace Api.Models;

public record ConnectionRow(
    string EdgeKey,
    string EndpointA,
    string EndpointB,
    string ServiceName,
    int? ServicePort,
    string Protocol,
    long SeenCount,
    DateTime FirstSeen,
    DateTime LastSeen
);
