using Api.Auth;
using Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Route("api/customers")]
[Authorize]
public class CustomersController : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IResult> GetCustomers([FromServices] CustomerService customerService)
    {
        return Results.Ok(await customerService.GetCustomerAsync());
    }

    [HttpGet("me")]
    public async Task<IResult> GetCurrentCustomer([FromServices] CustomerService customerService)
    {
        if (User.IsInRole("Admin"))
        {
            return Results.Forbid();
        }

        var customerIdClaim = Jwt.CustomerIdClaim(User);
        if (customerIdClaim == null || !int.TryParse(customerIdClaim, out var customerId))
        {
            return Results.Forbid();
        }

        var customer = await customerService.GetCustomerByIdAsync(customerId);
        return customer == null ? Results.NotFound() : Results.Ok(customer);
    }
}
