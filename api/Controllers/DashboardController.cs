using Api.Auth;
using Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Api.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize]
public class DashboardController : ControllerBase
{
    [HttpGet("stats")]
    public async Task<IResult> GetStats(
        ClaimsPrincipal user,
        [FromServices] DashboardService dashboardService)
    {
        if (user.IsInRole("Admin"))
        {
            return Results.Ok(await dashboardService.GetStatsAsync());
        }

        var customerIdClaim = Jwt.CustomerIdClaim(user);
        if (customerIdClaim == null || !int.TryParse(customerIdClaim, out var customerId))
        {
            return Results.Forbid();
        }

        return Results.Ok(await dashboardService.GetStatsAsync(customerId));
    }

    [HttpGet("connections-history")]
    public async Task<IResult> GetConnectionsHistory(
        ClaimsPrincipal user,
        [FromQuery] int? days,
        [FromServices] DashboardService dashboardService)
    {
        var effectiveDays = days is > 0 ? days.Value : 90;

        if (user.IsInRole("Admin"))
        {
            return Results.Ok(await dashboardService.GetConnectionsHistoryAsync(effectiveDays));
        }

        var customerIdClaim = Jwt.CustomerIdClaim(user);
        if (customerIdClaim == null || !int.TryParse(customerIdClaim, out var customerId))
        {
            return Results.Forbid();
        }

        return Results.Ok(await dashboardService.GetConnectionsHistoryAsync(effectiveDays, customerId));
    }

    [HttpGet("top-connections")]
    public async Task<IResult> GetTopConnections(
        ClaimsPrincipal user,
        [FromQuery] int? limit,
        [FromServices] DashboardService dashboardService)
    {
        var effectiveLimit = limit is > 0 ? limit.Value : 100;

        if (user.IsInRole("Admin"))
        {
            return Results.Ok(await dashboardService.GetTopConnectionsAsync(effectiveLimit));
        }

        var customerIdClaim = Jwt.CustomerIdClaim(user);
        if (customerIdClaim == null || !int.TryParse(customerIdClaim, out var customerId))
        {
            return Results.Forbid();
        }

        return Results.Ok(await dashboardService.GetTopConnectionsAsync(effectiveLimit, customerId));
    }

    [HttpGet("nodes")]
    public async Task<IResult> GetNodes(
        ClaimsPrincipal user,
        [FromQuery] int? limit,
        [FromServices] DashboardService dashboardService)
    {
        var effectiveLimit = limit is > 0 ? limit.Value : 100;

        if (user.IsInRole("Admin"))
        {
            return Results.Ok(await dashboardService.GetDashboardNodesAsync(effectiveLimit));
        }

        var customerIdClaim = Jwt.CustomerIdClaim(user);
        if (customerIdClaim == null || !int.TryParse(customerIdClaim, out var customerId))
        {
            return Results.Forbid();
        }

        return Results.Ok(await dashboardService.GetDashboardNodesAsync(effectiveLimit, customerId));
    }
}
