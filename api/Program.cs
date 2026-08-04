using Api.Auth;
using Api.Extensions;
using Api.Models;
using Api.Services;
using System.Globalization;
using System.Security.Claims;

var builder = WebApplication.CreateBuilder(args);

builder.Configuration.AddEnvironmentVariables();

builder.Services
    .AddApiJson()
    .AddDatabaseOptions(builder.Configuration)
    .AddApiCore()
    .AddApiAuthentication(builder.Configuration);

builder.Logging.ClearProviders();
builder.Logging.AddConsole();

var app = builder.Build();

app.UseResponseCompression();
app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.Logger.LogInformation("Starting API v{0}", typeof(Program).Assembly.GetName().Version);

app.MapHealthChecks("/api/healthz");
app.MapHealthChecks("/");

app.MapControllers();

// Layout:

// /api/graph - returns the full graph snapshot with cursor, use same function but just a zero cursor to get the full snapshot
// /api/graph?lastSeen={timestamp}&lastEdgeId={id}&lastNodeId={id} - returns the graph delta since the provided cursor
//
// /api/customer/{id}/graph - returns the full graph snapshot for a specific customer with cursor
// /api/customer/{id}/graph?lastSeen={timestamp}&lastEdgeId={id}&lastNodeId={id} - returns the graph delta for a specific customer since the provided cursor
//
// /api/customers - All customers in a list with ids and names, so the client can know which customer ids to use for the above endpoints

app.MapGet(
    "/api/graph",
    async (ClaimsPrincipal user, string? lastSeen, long? lastEdgeId, long? lastNodeId, bool? excludeIsolated, int? minLastSeenHours, bool? managedOnly, bool? distinctEdgesOnly, GraphService graphService) =>
    {
        var correct = DateTime.TryParse(
            lastSeen,
            CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
            out DateTime parsedLastSeen
        );
        if (!correct)
        {
            parsedLastSeen = DateTime.UnixEpoch;
            app.Logger.LogWarning(
                "Invalid lastSeen value: {0}. Defaulting to UnixEpoch.",
                lastSeen
            );
        }

        var cursor = new GraphCursor(parsedLastSeen, lastEdgeId ?? 0, lastNodeId ?? 0);
        var queryParams = new GraphQueryParams(ExcludeIsolated: excludeIsolated ?? false, MinLastSeenHours: minLastSeenHours, ManagedOnly: managedOnly ?? false, DistinctEdgesOnly: distinctEdgesOnly ?? false);

        if (user.IsInRole("Admin"))
            return Results.Ok(await graphService.GetGraphAsync(cursor, queryParams: queryParams));

        var customerIdClaim = Jwt.CustomerIdClaim(user);
        if (customerIdClaim == null || !int.TryParse(customerIdClaim, out var customerId))
            return Results.Forbid();

        return Results.Ok(await graphService.GetGraphAsync(cursor, customerId, queryParams));
    }
).RequireAuthorization();

app.MapGet("/api/customer/{customerId}/graph", async (int customerId, string? lastSeen, long? lastEdgeId, long? lastNodeId, bool? excludeIsolated, int? minLastSeenHours, bool? managedOnly, bool? distinctEdgesOnly, GraphService graphService) =>
{
    var correct = DateTime.TryParse(
        lastSeen,
        CultureInfo.InvariantCulture,
        DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
        out DateTime parsedLastSeen
    );
    if (!correct)
    {
        parsedLastSeen = DateTime.UnixEpoch;
        app.Logger.LogDebug(
            "Invalid lastSeen value: {0}. Defaulting to UnixEpoch.",
            lastSeen
        );
    }

    var cursor = new GraphCursor(parsedLastSeen, lastEdgeId ?? 0, lastNodeId ?? 0);
    var queryParams = new GraphQueryParams(ExcludeIsolated: excludeIsolated ?? false, MinLastSeenHours: minLastSeenHours, ManagedOnly: managedOnly ?? false, DistinctEdgesOnly: distinctEdgesOnly ?? false);
    app.Logger.LogInformation(
        "Received request for customer {0} with cursor: lastSeen={1}, lastEdgeId={2}, lastNodeId={3}",
        customerId,
        parsedLastSeen,
        lastEdgeId ?? 0,
        lastNodeId ?? 0
    );

    return await graphService.GetGraphAsync(cursor, customerId, queryParams);
}).RequireAuthorization("AdminOnly");

app.MapGet(
    "/api/node",
    async (ClaimsPrincipal user, string ciid, GraphService graphService) =>
    {
        if (string.IsNullOrWhiteSpace(ciid))
            return Results.BadRequest("ciid is required");

        var details = await graphService.GetNodeDetailsAsync(ciid);
        if (details is null) return Results.NotFound();

        if (!user.IsInRole("Admin"))
        {
            var customerIdClaim = Jwt.CustomerIdClaim(user);
            if (customerIdClaim == null || !long.TryParse(customerIdClaim, out var customerId) || details.Customer.Id != customerId)
                return Results.Forbid();
        }

        return Results.Ok(details);
    }
).RequireAuthorization();

app.MapGet(
    "/api/nodes/filter",
    async (ClaimsPrincipal user, string? customer, string? ip, string? mac,
           string? firstSeenAfter, string? firstSeenBefore,
           string? lastSeenAfter, string? lastSeenBefore,
           GraphService graphService) =>
    {
        DateTime? ParseDate(string? value) =>
            value != null && DateTime.TryParse(value, CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var dt) ? dt : null;

        int? scopeCustomerId = null;
        if (!user.IsInRole("Admin"))
        {
            var customerIdClaim = Jwt.CustomerIdClaim(user);
            if (customerIdClaim == null || !int.TryParse(customerIdClaim, out var cid))
                return Results.Forbid();
            scopeCustomerId = cid;
            customer = null; // prevent leaking other customer names via filter
        }

        var ciids = await graphService.FilterNodeCiidsAsync(
            customer, ip, mac,
            ParseDate(firstSeenAfter), ParseDate(firstSeenBefore),
            ParseDate(lastSeenAfter), ParseDate(lastSeenBefore),
            scopeCustomerId);

        return Results.Ok(ciids);
    }
).RequireAuthorization();

app.MapGet(
    "/api/customers",
    async (CustomerService customerService) => await customerService.GetCustomerAsync()
).RequireAuthorization("AdminOnly");

app.MapGet(
    "/api/dashboard/stats",
    async (ClaimsPrincipal user, DashboardService dashboardService) =>
    {
        if (user.IsInRole("Admin"))
            return Results.Ok(await dashboardService.GetStatsAsync());

        var customerIdClaim = Jwt.CustomerIdClaim(user);
        if (customerIdClaim == null || !int.TryParse(customerIdClaim, out var customerId))
            return Results.Forbid();

        return Results.Ok(await dashboardService.GetStatsAsync(customerId));
    }
).RequireAuthorization();

app.MapGet(
    "/api/dashboard/connections-history",
    async (ClaimsPrincipal user, int? days, DashboardService dashboardService) =>
    {
        var effectiveDays = days is > 0 ? days.Value : 90;

        if (user.IsInRole("Admin"))
            return Results.Ok(await dashboardService.GetConnectionsHistoryAsync(effectiveDays));

        var customerIdClaim = Jwt.CustomerIdClaim(user);
        if (customerIdClaim == null || !int.TryParse(customerIdClaim, out var customerId))
            return Results.Forbid();

        return Results.Ok(await dashboardService.GetConnectionsHistoryAsync(effectiveDays, customerId));
    }
).RequireAuthorization();

app.MapGet(
    "/api/dashboard/top-connections",
    async (ClaimsPrincipal user, int? limit, DashboardService dashboardService) =>
    {
        var effectiveLimit = limit is > 0 ? limit.Value : 100;

        if (user.IsInRole("Admin"))
            return Results.Ok(await dashboardService.GetTopConnectionsAsync(effectiveLimit));

        var customerIdClaim = Jwt.CustomerIdClaim(user);
        if (customerIdClaim == null || !int.TryParse(customerIdClaim, out var customerId))
            return Results.Forbid();

        return Results.Ok(await dashboardService.GetTopConnectionsAsync(effectiveLimit, customerId));
    }
).RequireAuthorization();

app.MapGet(
    "/api/dashboard/nodes",
    async (ClaimsPrincipal user, int? limit, DashboardService dashboardService) =>
    {
        var effectiveLimit = limit is > 0 ? limit.Value : 100;

        if (user.IsInRole("Admin"))
            return Results.Ok(await dashboardService.GetDashboardNodesAsync(effectiveLimit));

        var customerIdClaim = Jwt.CustomerIdClaim(user);
        if (customerIdClaim == null || !int.TryParse(customerIdClaim, out var customerId))
            return Results.Forbid();

        return Results.Ok(await dashboardService.GetDashboardNodesAsync(effectiveLimit, customerId));
    }
).RequireAuthorization();

try
{
    app.Run();
}
catch (OperationCanceledException) { }
