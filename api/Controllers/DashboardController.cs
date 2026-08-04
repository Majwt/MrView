using Api.Auth;
using Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize]
public class DashboardController : ControllerBase
{
    [HttpGet("stats")]
    public async Task<IResult> GetStats(
        [FromServices] DashboardService dashboardService)
    {
        if (User.IsInRole("Admin"))
        {
            return Results.Ok(await dashboardService.GetStatsAsync());
        }

        var customerIdClaim = Jwt.CustomerIdClaim(User);
        if (customerIdClaim == null || !int.TryParse(customerIdClaim, out var customerId))
        {
            return Results.Forbid();
        }

        return Results.Ok(await dashboardService.GetStatsAsync(customerId));
    }

    [HttpGet("connections-history")]
    public async Task<IResult> GetConnectionsHistory(
        [FromQuery] int? days,
        [FromServices] DashboardService dashboardService)
    {
        var effectiveDays = days is > 0 ? days.Value : 90;

        if (User.IsInRole("Admin"))
        {
            return Results.Ok(await dashboardService.GetConnectionsHistoryAsync(effectiveDays));
        }

        var customerIdClaim = Jwt.CustomerIdClaim(User);
        if (customerIdClaim == null || !int.TryParse(customerIdClaim, out var customerId))
        {
            return Results.Forbid();
        }

        return Results.Ok(await dashboardService.GetConnectionsHistoryAsync(effectiveDays, customerId));
    }

    [HttpGet("top-connections")]
    public async Task<IResult> GetTopConnections(
        [FromQuery] int? limit,
        [FromServices] DashboardService dashboardService)
    {
        var effectiveLimit = limit is > 0 ? limit.Value : 100;

        if (User.IsInRole("Admin"))
        {
            return Results.Ok(await dashboardService.GetTopConnectionsAsync(effectiveLimit));
        }

        var customerIdClaim = Jwt.CustomerIdClaim(User);
        if (customerIdClaim == null || !int.TryParse(customerIdClaim, out var customerId))
        {
            return Results.Forbid();
        }

        return Results.Ok(await dashboardService.GetTopConnectionsAsync(effectiveLimit, customerId));
    }

    [HttpGet("nodes")]
    public async Task<IResult> GetNodes(
        [FromQuery] int? limit,
        [FromServices] DashboardService dashboardService)
    {
        var effectiveLimit = limit is > 0 ? limit.Value : 100;

        if (User.IsInRole("Admin"))
        {
            return Results.Ok(await dashboardService.GetDashboardNodesAsync(effectiveLimit));
        }

        var customerIdClaim = Jwt.CustomerIdClaim(User);
        if (customerIdClaim == null || !int.TryParse(customerIdClaim, out var customerId))
        {
            return Results.Forbid();
        }

        return Results.Ok(await dashboardService.GetDashboardNodesAsync(effectiveLimit, customerId));
    }
}
