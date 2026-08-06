using Api.Auth;
using Api.Models;
using Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Globalization;

namespace Api.Controllers;

[ApiController]
public class GraphController(ILogger<GraphController> logger) : ControllerBase
{
    [HttpGet("api/graph")]
    [Authorize]
    public async Task<IResult> GetGraph(
        [FromQuery] string? lastSeen,
        [FromQuery] long? lastEdgeId,
        [FromQuery] long? lastNodeId,
        [FromQuery] bool? excludeIsolated,
        [FromQuery] int? minLastSeenHours,
        [FromQuery] bool? managedOnly,
        [FromQuery] bool? distinctEdgesOnly,
        [FromServices] GraphService graphService)
    {
        var valid = DateTime.TryParse(
            lastSeen,
            CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
            out var parsedLastSeen);

        if (!valid)
        {
            parsedLastSeen = DateTime.UnixEpoch;
            logger.LogWarning("Invalid lastSeen value: {LastSeen}. Defaulting to UnixEpoch.", lastSeen);
        }

        var cursor = new GraphCursor(parsedLastSeen, lastEdgeId ?? 0, lastNodeId ?? 0);
        var queryParams = new GraphQueryParams(
            ExcludeIsolated: excludeIsolated ?? false,
            MinLastSeenHours: minLastSeenHours,
            ManagedOnly: managedOnly ?? false,
            DistinctEdgesOnly: distinctEdgesOnly ?? false);

        if (User.IsInRole("Admin"))
        {
            return Results.Ok(await graphService.GetGraphAsync(cursor, queryParams: queryParams));
        }

        var customerIdClaim = Jwt.CustomerIdClaim(User);
        if (customerIdClaim == null || !int.TryParse(customerIdClaim, out var customerId))
        {
            return Results.Forbid();
        }

        return Results.Ok(await graphService.GetGraphAsync(cursor, customerId, queryParams));
    }

    [HttpGet("api/customer/{customerId}/graph")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IResult> GetCustomerGraph(
        int customerId,
        [FromQuery] string? lastSeen,
        [FromQuery] long? lastEdgeId,
        [FromQuery] long? lastNodeId,
        [FromQuery] bool? excludeIsolated,
        [FromQuery] int? minLastSeenHours,
        [FromQuery] bool? managedOnly,
        [FromQuery] bool? distinctEdgesOnly,
        [FromServices] GraphService graphService)
    {
        var valid = DateTime.TryParse(
            lastSeen,
            CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
            out var parsedLastSeen);

        if (!valid)
        {
            parsedLastSeen = DateTime.UnixEpoch;
            logger.LogDebug("Invalid lastSeen value: {LastSeen}. Defaulting to UnixEpoch.", lastSeen);
        }

        var cursor = new GraphCursor(parsedLastSeen, lastEdgeId ?? 0, lastNodeId ?? 0);
        var queryParams = new GraphQueryParams(
            ExcludeIsolated: excludeIsolated ?? false,
            MinLastSeenHours: minLastSeenHours,
            ManagedOnly: managedOnly ?? false,
            DistinctEdgesOnly: distinctEdgesOnly ?? false);

        logger.LogInformation(
            "Received request for customer {CustomerId} with cursor: lastSeen={LastSeen}, lastEdgeId={LastEdgeId}, lastNodeId={LastNodeId}",
            customerId,
            parsedLastSeen,
            lastEdgeId ?? 0,
            lastNodeId ?? 0);

        return Results.Ok(await graphService.GetGraphAsync(cursor, customerId, queryParams));
    }

    [HttpGet("api/node")]
    [Authorize]
    public async Task<IResult> GetNode(
        [FromQuery] string ciid,
        [FromServices] GraphService graphService)
    {
        if (string.IsNullOrWhiteSpace(ciid))
        {
            return Results.BadRequest("ciid is required");
        }

        var details = await graphService.GetNodeDetailsAsync(ciid);
        if (details is null)
        {
            return Results.NotFound();
        }

        if (!User.IsInRole("Admin"))
        {
            var customerIdClaim = Jwt.CustomerIdClaim(User);
            if (customerIdClaim == null
                || !long.TryParse(customerIdClaim, out var customerId)
                || details.Customer.Id != customerId)
            {
                return Results.Forbid();
            }
        }

        return Results.Ok(details);
    }

    [HttpGet("api/nodes/filter")]
    [Authorize]
    public async Task<IResult> FilterNodes(
        [FromQuery] string? customer,
        [FromQuery] string? ip,
        [FromQuery] string? mac,
        [FromQuery] string? firstSeenAfter,
        [FromQuery] string? firstSeenBefore,
        [FromQuery] string? lastSeenAfter,
        [FromQuery] string? lastSeenBefore,
        [FromServices] GraphService graphService)
    {
        static DateTime? ParseDate(string? value)
        {
            return value != null
                && DateTime.TryParse(
                    value,
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
                    out var parsed)
                ? parsed
                : null;
        }

        int? scopedCustomerId = null;
        if (!User.IsInRole("Admin"))
        {
            var customerIdClaim = Jwt.CustomerIdClaim(User);
            if (customerIdClaim == null || !int.TryParse(customerIdClaim, out var customerId))
            {
                return Results.Forbid();
            }

            scopedCustomerId = customerId;
            customer = null;
        }

        var ciids = await graphService.FilterNodeCiidsAsync(
            customer,
            ip,
            mac,
            ParseDate(firstSeenAfter),
            ParseDate(firstSeenBefore),
            ParseDate(lastSeenAfter),
            ParseDate(lastSeenBefore),
            scopedCustomerId);

        return Results.Ok(ciids);
    }
}
