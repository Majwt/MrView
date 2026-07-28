namespace Api.Models;

public sealed record GraphQueryParams(
    bool ExcludeIsolated = false,
    int? MinLastSeenHours = null
);
