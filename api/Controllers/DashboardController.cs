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
    [HttpGet("/api/customer/{customerId:int}/dashboard/stats")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IResult> GetCustomerStats(
        int customerId,
        [FromServices] DashboardService dashboardService)
    {
        return Results.Ok(await dashboardService.GetStatsAsync(customerId));
    }

    [HttpGet("/api/customer/{customerId:int}/dashboard/distinct-edges")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IResult> GetCustomerSumConnections(
        [FromQuery]int lastDays,
        int customerId,
        [FromServices] DashboardService dashboardService)
    {
        return Results.Ok(await dashboardService.GetDistinctEdgesAsync(lastDays, customerId));
    }

    [HttpGet("/api/customer/{customerId:int}/dashboard/active-nodes")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IResult> GetCustomerActiveNodes(
        [FromQuery]int lastDays,
        int customerId,
        [FromServices] DashboardService dashboardService)
    {
        return Results.Ok(await dashboardService.GetActiveNodesAsync(lastDays, customerId));

    }
    [HttpGet("/api/customer/{customerId:int}/dashboard/total-events")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IResult> GetCustomerTotalEvents(
        [FromQuery]int lastDays,
        int customerId,
        [FromServices] DashboardService dashboardService)
    {
        return Results.Ok(await dashboardService.GetTotalEventsAsync(lastDays, customerId));
    }
    [HttpGet("/api/customer/{customerId:int}/dashboard/new-connections")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IResult> GetCustomerNewConnections(
        [FromQuery]int lastDays,
        int customerId,
        [FromServices] DashboardService dashboardService)
    {
        return Results.Ok(await dashboardService.GetNewConnectionsAsync(lastDays, customerId));
    }





    [HttpGet("/api/customer/{customerId:int}/dashboard/connections-history")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IResult> GetCustomerConnectionsHistory(
        int customerId,
        [FromQuery] int? days,
        [FromServices] DashboardService dashboardService)
    {
        var effectiveDays = days is > 0 ? days.Value : 90;
        return Results.Ok(await dashboardService.GetConnectionsHistoryAsync(effectiveDays, customerId));
    }

    [HttpGet("/api/customer/{customerId:int}/dashboard/top-connections")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IResult> GetCustomerTopConnections(
        int customerId,
        [FromQuery] int? limit,
        [FromServices] DashboardService dashboardService)
    {
        var effectiveLimit = limit is > 0 ? limit.Value : 100;
        return Results.Ok(await dashboardService.GetTopConnectionsAsync(effectiveLimit, customerId));
    }

    [HttpGet("/api/customer/{customerId:int}/dashboard/nodes")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IResult> GetCustomerNodes(
        int customerId,
        [FromQuery] int? limit,
        [FromServices] DashboardService dashboardService)
    {
        var effectiveLimit = limit is > 0 ? limit.Value : 100;
        return Results.Ok(await dashboardService.GetDashboardNodesAsync(effectiveLimit, customerId));
    }

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

    [HttpGet("distinct-edges")]
    public async Task<IResult> GetDistinctEdges(
        [FromQuery]int lastDays,
        [FromServices] DashboardService dashboardService)
    {
        if (User.IsInRole("Admin"))
        {
            return Results.Ok(await dashboardService.GetDistinctEdgesAsync(lastDays));
        }

        var customerIdClaim = Jwt.CustomerIdClaim(User);
        if (customerIdClaim == null || !int.TryParse(customerIdClaim, out var customerId))
        {
            return Results.Forbid();
        }

        return Results.Ok(await dashboardService.GetDistinctEdgesAsync(lastDays, customerId));
    }

    [HttpGet("active-nodes")]
    public async Task<IResult> GetActiveNodes(
        [FromQuery]int lastDays,
        [FromServices] DashboardService dashboardService)
    {
        if (User.IsInRole("Admin"))
        {
            return Results.Ok(await dashboardService.GetActiveNodesAsync(lastDays));
        }

        var customerIdClaim = Jwt.CustomerIdClaim(User);
        if (customerIdClaim == null || !int.TryParse(customerIdClaim, out var customerId))
        {
            return Results.Forbid();
        }

        return Results.Ok(await dashboardService.GetActiveNodesAsync(lastDays, customerId));
    }
    [HttpGet("total-events")]
    public async Task<IResult> GetTotalEvents(
        [FromQuery]int lastDays,
        [FromServices] DashboardService dashboardService)
    {

        if (User.IsInRole("Admin"))
        {
            return Results.Ok(await dashboardService.GetTotalEventsAsync(lastDays));
        }

        var customerIdClaim = Jwt.CustomerIdClaim(User);
        if (customerIdClaim == null || !int.TryParse(customerIdClaim, out var customerId))
        {
            return Results.Forbid();
        }

        return Results.Ok(await dashboardService.GetTotalEventsAsync(lastDays, customerId));
    }
    [HttpGet("new-connections")]
    public async Task<IResult> GetNewConnections(
        [FromQuery]int lastDays,
        [FromServices] DashboardService dashboardService)
    {

        if (User.IsInRole("Admin"))
        {
            return Results.Ok(await dashboardService.GetNewConnectionsAsync(lastDays));
        }

        var customerIdClaim = Jwt.CustomerIdClaim(User);
        if (customerIdClaim == null || !int.TryParse(customerIdClaim, out var customerId))
        {
            return Results.Forbid();
        }

        return Results.Ok(await dashboardService.GetNewConnectionsAsync(lastDays, customerId));
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
