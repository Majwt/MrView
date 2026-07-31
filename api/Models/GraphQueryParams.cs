namespace Api.Models;

public sealed record GraphQueryParams(
    bool ExcludeIsolated = false,
    int? MinLastSeenHours = null,
    bool ManagedOnly = false
);
